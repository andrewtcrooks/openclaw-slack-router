# Phase 3: Subagent Interface + First Real Subagent - Research

**Researched:** 2026-03-29
**Domain:** TypeScript subagent interface + openclaw gateway WebSocket integration
**Confidence:** HIGH

## Summary

Phase 3 replaces the Phase 2 stub dispatch with a real `SubagentDefinition` interface and one concrete subagent that calls the locally-running openclaw gateway via its `chat.send` WebSocket RPC method.

The critical discovery (D-14) is that `chat.send` uses an **asynchronous event-based response pattern**: the RPC call returns an immediate ack `{ runId, status: "started" }`, and the actual assistant response arrives later as a broadcast `chat` event with `state: "final"`. This means a simple fire-and-forget RPC is insufficient. The Slack router must implement a thin WebSocket client that connects, sends the request, and waits for the matching `chat` event.

The openclaw gateway client (`GatewayClient`) is NOT exported as a public API from the `openclaw` npm package. The Slack router must build its own minimal gateway client using the `ws` package, following the connect handshake protocol (connect.challenge -> connect request -> helloOk -> chat.send -> listen for chat events).

**Primary recommendation:** Build a thin `GatewayChat` wrapper in `src/gateway/` that handles WebSocket lifecycle, connect handshake, and chat event collection. The openclaw gateway subagent instantiates this client and exposes a simple `sendAndWait(sessionKey, message, idempotencyKey): Promise<string>` method.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: SubagentDefinition interface shape: `{ name: string; description: string; handle(ctx: SubagentContext): Promise<string> }`
- D-02: Openclaw gateway client and sessionKey resolution are injected at construction time
- D-03: SubagentEntry (name + description) is the config shape; SubagentDefinition extends it with handle()
- D-04: Rename SubagentContext.history -> SubagentContext.threadHistory
- D-05: The rename touches: types.ts, context.ts, context.test.ts, events/app-mention.ts, events/message.ts, and test files
- D-06: Do the rename in the same phase (not a separate PR)
- D-07: Static map pattern: src/subagents/index.ts exports Record<string, SubagentDefinition>
- D-08: createApp() receives the subagent registry map as a parameter
- D-09: Adding a new subagent = create file in src/subagents/, register in src/subagents/index.ts
- D-10: First concrete subagent calls openclaw gateway via callGateway/GatewayClient pattern using chat.send
- D-11: SessionKey = ctx.channelId directly (e.g., "C08ABC123")
- D-12: Each Slack channel maps to one openclaw session; all agent prefixes share the session
- D-13: Gateway URL defaults to ws://127.0.0.1:18789, configurable via OPENCLAW_GATEWAY_URL env var
- D-14: Response collection pattern researched (see Architecture Patterns below)
- D-15: idempotencyKey = derived from Slack event_ts or UUID per dispatch

### Claude's Discretion
- Error handling for gateway failures (timeout, connection refused) -- catch and return error string
- Whether SubagentEntry and SubagentDefinition merge into one type or stay separate
- File structure inside src/subagents/ (flat vs. subdirectory per subagent)

### Deferred Ideas (OUT OF SCOPE)
- Multiple subagent types (research, code, opus) -- Phase 4
- Per-agent model selection / openclaw session config -- Phase 4
- Channel -> openclaw session auto-creation if session doesn't exist -- Phase 4
- LLM-based routing classifier -- v2 (ROUTE-V2-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-01 | Subagents are defined as TypeScript modules with a standard interface | SubagentDefinition interface pattern; src/subagents/ directory structure |
| AGENT-02 | Each subagent receives: thread history, current message, and metadata (user, channel, thread_ts) | SubagentContext already built in Phase 2; rename history->threadHistory |
| AGENT-03 | Subagent responses are posted back to the Slack thread | Replace stub dispatch with registry[agentName].handle(ctx); post result via say() |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ws | 8.20.0 | WebSocket client for gateway communication | Same library openclaw uses; standard Node.js WebSocket client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @slack/bolt | ^4.6.0 | Already installed | Event handling, say() for posting responses |
| zod | ^3.24.0 | Already installed | Env var validation for OPENCLAW_GATEWAY_URL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws (raw WebSocket) | Import openclaw GatewayClient directly | NOT possible -- GatewayClient is not in openclaw's package.json exports. Only `.`, `./plugin-sdk`, and `./cli-entry` are exported. Building a thin client is the only option. |
| Long-lived persistent WebSocket | Connect-per-request | Connect-per-request is simpler, avoids reconnect/state management. Slight latency overhead (~50ms connect) is acceptable for Slack's response time expectations. |
| Poll chat.history after chat.send | Listen for chat events | Polling adds latency and complexity. Event listening is the correct pattern used by all openclaw clients (TUI, ACP translator). |

**Installation:**
```bash
npm install ws
npm install -D @types/ws
```

**Version verification:** ws 8.20.0 confirmed via npm registry 2026-03-29.

## Architecture Patterns

### Recommended Project Structure
```
src/
  subagents/
    index.ts           # Registry: Record<string, SubagentDefinition>
    types.ts           # SubagentDefinition interface
    openclaw-gateway.ts # First concrete subagent
  gateway/
    chat-client.ts     # Thin WebSocket client for openclaw gateway chat.send
  types.ts             # SubagentContext (with threadHistory rename), SubagentEntry, etc.
  app.ts               # createApp() -- add subagentRegistry param
  events/              # Replace stub dispatch with registry lookup
  ...existing files...
```

### Pattern 1: SubagentDefinition Interface
**What:** Pure interface that all subagents implement
**When to use:** Every subagent module
**Example:**
```typescript
// src/subagents/types.ts
import type { SubagentContext } from "../types.js";

export interface SubagentDefinition {
  name: string;
  description: string;
  handle(ctx: SubagentContext): Promise<string>;
}
```

**Recommendation on D-03 (Claude's Discretion):** Keep `SubagentEntry` (in types.ts) and `SubagentDefinition` (in subagents/types.ts) as separate types. SubagentEntry is the config schema shape (loaded from JSON). SubagentDefinition is the runtime interface (has handle()). They serve different layers. The config maps agent names to SubagentEntry; the registry maps agent names to SubagentDefinition.

### Pattern 2: Subagent Registry
**What:** Static map of agent name -> SubagentDefinition, passed to createApp()
**When to use:** Wiring at startup
**Example:**
```typescript
// src/subagents/index.ts
import type { SubagentDefinition } from "./types.js";
import { createOpenclawGatewaySubagent } from "./openclaw-gateway.js";

export type SubagentRegistry = Record<string, SubagentDefinition>;

export function buildSubagentRegistry(gatewayUrl: string): SubagentRegistry {
  return {
    default: createOpenclawGatewaySubagent({ gatewayUrl }),
    // Phase 4 adds more here
  };
}
```

### Pattern 3: Gateway Chat Client (D-14 Resolution)
**What:** Thin WebSocket client that sends chat.send and collects the final response
**When to use:** Inside the openclaw-gateway subagent

The openclaw gateway protocol works as follows:

1. **Connect**: Client opens WebSocket to `ws://127.0.0.1:18789`
2. **Challenge**: Server sends event `{ event: "connect.challenge", payload: { nonce: "..." } }`
3. **Handshake**: Client sends request `{ type: "req", id: UUID, method: "connect", params: { minProtocol, maxProtocol, client: {...}, role: "operator", scopes: [...] } }` with the nonce from the challenge
4. **HelloOk**: Server responds with `{ type: "res", id: ..., ok: true, payload: { auth: ..., policy: ... } }`
5. **chat.send**: Client sends `{ type: "req", id: UUID, method: "chat.send", params: { sessionKey, message, idempotencyKey } }`
6. **Ack**: Server responds with `{ type: "res", id: ..., ok: true, payload: { runId, status: "started" } }`
7. **Streaming**: Server broadcasts event frames `{ type: "evt", event: "chat", payload: { runId, sessionKey, seq, state: "delta", message: { content: [{ type: "text", text: "..." }] } } }`
8. **Final**: Server broadcasts `{ type: "evt", event: "chat", payload: { runId, sessionKey, seq, state: "final", message: { role: "assistant", content: [{ type: "text", text: "full response" }], stopReason: "stop" } } }`

**Critical detail:** The `message.content` in the final event is an array of content blocks. The text is extracted as:
```typescript
const content = message.content as Array<{ type: string; text?: string }>;
const text = content?.find(c => c.type === "text")?.text ?? "";
```

**Connect params required fields (minimum viable):**
```typescript
{
  minProtocol: 1,  // PROTOCOL_VERSION from openclaw
  maxProtocol: 1,
  client: {
    id: "slack-router",
    version: "0.1.0",
    platform: process.platform,
    mode: "backend",
  },
  caps: [],
  role: "operator",
  scopes: ["operator.admin"],
}
```

**Authentication:** The gateway running locally (loopback) uses device identity auth. For the Slack router, the simplest approach is to pass a gateway token or password if required. If the gateway has no auth configured (common in local dev), the connect will succeed without credentials. Add optional `OPENCLAW_GATEWAY_TOKEN` env var.

**Example implementation:**
```typescript
// src/gateway/chat-client.ts
import WebSocket from "ws";
import { randomUUID } from "node:crypto";

export interface GatewayChatOptions {
  url: string;       // ws://127.0.0.1:18789
  token?: string;    // optional auth token
  timeoutMs?: number; // default 120_000
}

export interface ChatSendResult {
  text: string;
  runId: string;
}

export async function gatewayChatSend(
  options: GatewayChatOptions,
  params: { sessionKey: string; message: string; idempotencyKey: string },
): Promise<ChatSendResult> {
  const { url, token, timeoutMs = 120_000 } = options;
  const { sessionKey, message, idempotencyKey } = params;

  return new Promise<ChatSendResult>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(url, { maxPayload: 25 * 1024 * 1024 });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error(`gateway timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      ws.close();
    };

    const sendReq = (method: string, reqParams: unknown): string => {
      const id = randomUUID();
      ws.send(JSON.stringify({ type: "req", id, method, params: reqParams }));
      return id;
    };

    let connectReqId: string | null = null;
    let chatSendReqId: string | null = null;
    let chatRunId: string | null = null;
    // Track accumulated text from delta events for fallback
    let deltaText = "";

    ws.on("open", () => { /* wait for connect.challenge event */ });

    ws.on("message", (data) => {
      if (settled) return;
      const raw = typeof data === "string" ? data : data.toString();
      let frame: any;
      try { frame = JSON.parse(raw); } catch { return; }

      // Event frames
      if (frame.type === "evt") {
        if (frame.event === "connect.challenge") {
          const nonce = frame.payload?.nonce;
          connectReqId = sendReq("connect", {
            minProtocol: 1,
            maxProtocol: 1,
            client: { id: "slack-router", version: "0.1.0", platform: process.platform, mode: "backend" },
            caps: [],
            role: "operator",
            scopes: ["operator.admin"],
            ...(token ? { auth: { token } } : {}),
            device: undefined,
          });
          return;
        }
        if (frame.event === "chat") {
          const p = frame.payload;
          if (p?.runId !== chatRunId) return;

          if (p.state === "delta" && p.message) {
            // Accumulate delta text as fallback
            const content = p.message.content as Array<{ type: string; text?: string }> | undefined;
            const text = content?.find((c: any) => c.type === "text")?.text ?? "";
            if (text) deltaText = text; // delta text is cumulative (full so far)
          }

          if (p.state === "final") {
            settled = true;
            const text = extractTextFromMessage(p.message) || deltaText;
            cleanup();
            resolve({ text, runId: chatRunId! });
            return;
          }
          if (p.state === "error") {
            settled = true;
            cleanup();
            reject(new Error(p.errorMessage ?? "gateway chat error"));
            return;
          }
          if (p.state === "aborted") {
            settled = true;
            cleanup();
            reject(new Error("gateway chat aborted"));
            return;
          }
        }
        return;
      }

      // Response frames
      if (frame.type === "res") {
        if (frame.id === connectReqId) {
          if (!frame.ok) {
            settled = true;
            cleanup();
            reject(new Error(frame.error?.message ?? "gateway connect failed"));
            return;
          }
          // Connected -- send chat.send
          chatSendReqId = sendReq("chat.send", { sessionKey, message, idempotencyKey });
          return;
        }
        if (frame.id === chatSendReqId) {
          if (!frame.ok) {
            settled = true;
            cleanup();
            reject(new Error(frame.error?.message ?? "chat.send failed"));
            return;
          }
          chatRunId = frame.payload?.runId ?? idempotencyKey;
          // Now wait for chat events...
          return;
        }
      }
    });

    ws.on("error", (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    ws.on("close", (code, reason) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`gateway closed (${code}): ${reason?.toString() ?? ""}`));
      }
    });
  });
}

function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as Record<string, unknown>;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return (msg.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === "text" && c.text)
      .map(c => c.text!)
      .join("\n");
  }
  if (typeof msg.text === "string") return msg.text;
  return "";
}
```

### Pattern 4: Stub Dispatch Replacement
**What:** Replace `say(stub)` with `registry[route.agentName].handle(context)` in both event handlers
**When to use:** app-mention.ts and message.ts

```typescript
// In event handler, replace lines 40-44:
// Before (Phase 2 stub):
await say({
  text: `[${context.agentName}] ${context.currentMessage} (${context.history.length} history msgs)`,
  thread_ts: threadTs,
});

// After (Phase 3):
const subagent = subagentRegistry[route.agentName];
if (!subagent) {
  await say({ text: `Unknown subagent: ${route.agentName}`, thread_ts: threadTs });
  return;
}
const response = await subagent.handle(context);
await say({ text: response, thread_ts: threadTs });
```

### Anti-Patterns to Avoid
- **Importing from openclaw source directly:** The openclaw repo is a sibling git repo, not a dependency. Do NOT use relative paths like `../../openclaw/src/...`. Build the thin client in this repo.
- **Long-lived persistent gateway connection:** For Phase 3, connect-per-request is simpler and correct. A persistent connection adds reconnect logic, heartbeat handling, and state management that isn't needed yet.
- **Streaming responses to Slack:** Do NOT attempt to stream delta events to Slack. Slack message editing for streaming is rate-limited and adds complexity. Wait for the final response, post once.
- **Passing the full SubagentConfig to subagent handle():** The SubagentContext already contains everything the subagent needs. Gateway config (URL, token) is injected at subagent construction time, not per-call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket client | Raw net.Socket | `ws` package | Handles frames, masking, close codes correctly |
| UUID generation | Custom ID scheme | `crypto.randomUUID()` | Standard, collision-free, matches openclaw pattern |
| JSON-RPC framing | Custom protocol parser | Inline frame parsing (type/id/method/payload) | Protocol is simple enough; no library needed. Just parse JSON and switch on `type` field |
| Gateway auth | Complex device identity | Simple token auth (`OPENCLAW_GATEWAY_TOKEN` env) | Device identity requires keypair generation. Token auth is sufficient for a local backend service |

**Key insight:** The openclaw gateway protocol is a thin JSON-over-WebSocket RPC with event broadcasting. It is simple enough that a 100-line client covers the needed functionality for `chat.send`. Do NOT try to replicate the full `GatewayClient` class (500+ lines with reconnect, TLS pinning, device auth, tick watch).

## Common Pitfalls

### Pitfall 1: Confusing RPC Response with Chat Event
**What goes wrong:** Treating the `chat.send` RPC response `{ runId, status: "started" }` as the assistant's answer
**Why it happens:** Most RPC patterns return the result in the response. Openclaw's chat.send returns an ack and streams the actual answer via broadcast events.
**How to avoid:** After receiving the `chat.send` ack, keep the WebSocket open and listen for `chat` events with matching `runId` and `state: "final"`
**Warning signs:** Getting `{ runId: "...", status: "started" }` as the "response" text posted to Slack

### Pitfall 2: Missing the Connect Handshake
**What goes wrong:** Sending `chat.send` immediately after WebSocket open, getting no response or disconnect
**Why it happens:** The gateway requires a challenge-response connect handshake before accepting any RPC calls
**How to avoid:** Wait for `connect.challenge` event, send `connect` request, wait for helloOk response, THEN send chat.send
**Warning signs:** WebSocket closes with code 1008 shortly after connecting

### Pitfall 3: Protocol Version Mismatch
**What goes wrong:** Connect rejected by gateway
**Why it happens:** The gateway checks `minProtocol`/`maxProtocol` against its own version
**How to avoid:** Use `minProtocol: 1, maxProtocol: 1` (current version). If the gateway updates its protocol version, this will need to match.
**Warning signs:** Connect response with `ok: false` and version mismatch error

### Pitfall 4: Text Extraction from Content Blocks
**What goes wrong:** Getting empty or `[object Object]` as response text
**Why it happens:** The `message.content` in chat events is an array of content blocks `[{ type: "text", text: "..." }]`, not a plain string
**How to avoid:** Use `extractTextFromMessage()` that handles both string content and content block arrays
**Warning signs:** Response is empty or contains JSON

### Pitfall 5: Forgetting the threadHistory Rename in Tests
**What goes wrong:** Tests pass but runtime breaks, or tests break because they still reference `.history`
**Why it happens:** D-04 renames `SubagentContext.history` to `threadHistory`. Tests reference the old name.
**How to avoid:** Grep for `.history` across all test files; update context.test.ts, app-mention.test.ts, message.test.ts
**Warning signs:** TypeScript compilation errors on `.history` property

### Pitfall 6: Gateway Not Running
**What goes wrong:** Connection refused on ws://127.0.0.1:18789
**Why it happens:** The openclaw gateway must be running locally for the subagent to work
**How to avoid:** Catch connection errors in the gateway client; return a user-friendly error string like "Could not reach openclaw gateway" rather than crashing
**Warning signs:** ECONNREFUSED errors in logs

## Code Examples

### Extract Text from Gateway Chat Message
```typescript
// Source: Derived from openclaw/src/tui/tui-event-handlers.ts and openclaw/src/acp/translator.ts
function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as Record<string, unknown>;
  // String content (simple case)
  if (typeof msg.content === "string") return msg.content;
  // Content block array (standard case)
  if (Array.isArray(msg.content)) {
    return (msg.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === "text" && c.text)
      .map(c => c.text!)
      .join("\n");
  }
  // Fallback: top-level text field
  if (typeof msg.text === "string") return msg.text;
  return "";
}
```

### Gateway Chat Send Schema
```typescript
// Source: openclaw/src/gateway/protocol/schema/logs-chat.ts
// ChatSendParamsSchema requires:
{
  sessionKey: string;      // NonEmptyString -- use ctx.channelId (e.g. "C08ABC123")
  message: string;         // The user's message text
  idempotencyKey: string;  // NonEmptyString -- UUID or derived from Slack event_ts
  // Optional:
  thinking?: string;       // Thinking prompt (not needed for Phase 3)
  deliver?: boolean;       // Whether to deliver to external channels (not needed)
  attachments?: unknown[]; // File attachments (not needed for Phase 3)
  timeoutMs?: number;      // Override default timeout
}
```

### Chat Event Schema
```typescript
// Source: openclaw/src/gateway/protocol/schema/logs-chat.ts ChatEventSchema
{
  runId: string;
  sessionKey: string;
  seq: number;           // Monotonically increasing per run
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;     // Content blocks on delta/final
  errorMessage?: string; // On error state
  usage?: unknown;       // Token usage stats
  stopReason?: string;   // "stop", etc.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct SDK calls (Anthropic/OpenAI) | Gateway-mediated chat via WebSocket RPC | openclaw architecture | Model selection, session management, auth all handled by gateway. Slack router is thin. |
| Request-response RPC for chat | Async ack + event stream pattern | openclaw gateway design | Enables streaming, abort, concurrent runs. Client must listen for events. |

## Open Questions

1. **Gateway authentication for local connections**
   - What we know: Local loopback connections may not require auth. The gateway supports token and password auth. Device identity auth requires keypair generation (complex).
   - What's unclear: Whether the user's local gateway requires auth for loopback connections.
   - Recommendation: Make `OPENCLAW_GATEWAY_TOKEN` optional. If set, pass it in the connect auth. If not set, connect without auth. Let the gateway reject if auth is required -- the error will be clear.

2. **Protocol version stability**
   - What we know: Current `PROTOCOL_VERSION` is 1 (imported from openclaw gateway protocol).
   - What's unclear: How often protocol version changes. The Slack router hardcodes `minProtocol: 1, maxProtocol: 1`.
   - Recommendation: Hardcode for now. Add a comment noting this must match the gateway's protocol version. A mismatch will produce a clear error.

3. **Gateway timeout for LLM responses**
   - What we know: The gateway has `resolveAgentTimeoutMs` (configurable). Default is likely 30-120 seconds.
   - What's unclear: What timeout the Slack router client should use.
   - Recommendation: Default to 120 seconds (2 minutes). Configurable via `OPENCLAW_GATEWAY_TIMEOUT_MS` env var. This is generous enough for complex LLM responses.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Assumed (project already runs) | -- | -- |
| ws (npm) | Gateway client | Not yet installed | 8.20.0 target | -- |
| openclaw gateway (local) | chat.send RPC | Must be running at ws://127.0.0.1:18789 | -- | Return error string to Slack |

**Missing dependencies with no fallback:**
- `ws` npm package -- must be installed (Phase 3 task)

**Missing dependencies with fallback:**
- openclaw gateway process -- if not running, subagent returns error message to Slack user rather than crashing

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | SubagentDefinition interface + registry wiring | unit | `npx vitest run src/subagents/index.test.ts -x` | No -- Wave 0 |
| AGENT-02 | SubagentContext.threadHistory rename + context passing | unit | `npx vitest run src/context.test.ts -x` | Yes (needs update for rename) |
| AGENT-03 | Real subagent response posted to Slack thread | unit | `npx vitest run src/events/app-mention.test.ts src/events/message.test.ts -x` | Yes (needs update for registry) |
| -- | Gateway chat client send+receive | unit | `npx vitest run src/gateway/chat-client.test.ts -x` | No -- Wave 0 |
| -- | Openclaw gateway subagent handle() | unit | `npx vitest run src/subagents/openclaw-gateway.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/subagents/index.test.ts` -- tests registry building and agent name resolution
- [ ] `src/gateway/chat-client.test.ts` -- tests WebSocket protocol flow with mock server (connect handshake, chat.send ack, chat event final/error)
- [ ] `src/subagents/openclaw-gateway.test.ts` -- tests handle() with mocked gateway chat client
- [ ] Update `src/context.test.ts` -- rename .history to .threadHistory in assertions
- [ ] Update `src/events/app-mention.test.ts` -- replace stub dispatch expectations with registry-based dispatch
- [ ] Update `src/events/message.test.ts` -- same as above

## Sources

### Primary (HIGH confidence)
- `/Users/andrew/git/openclaw/src/gateway/call.ts` -- callGateway pattern, executeGatewayRequestWithScopes flow
- `/Users/andrew/git/openclaw/src/gateway/client.ts` -- GatewayClient WebSocket implementation, connect handshake, request/response/event frame handling
- `/Users/andrew/git/openclaw/src/gateway/protocol/schema/logs-chat.ts` -- ChatSendParamsSchema, ChatEventSchema exact field definitions
- `/Users/andrew/git/openclaw/src/gateway/server-methods/chat.ts` -- Server-side chat.send handler: ack pattern (line 801), broadcastChatFinal (line 491), broadcastChatError (line 513), session auto-creation with createIfMissing (line 909)
- `/Users/andrew/git/openclaw/src/tui/gateway-chat.ts` -- TUI client sendChat() pattern, event-based response collection
- `/Users/andrew/git/openclaw/src/acp/translator.ts` -- ACP translator chat.send with expectFinal, handleChatEvent for delta/final collection
- `/Users/andrew/git/openclaw/package.json` -- exports field confirms GatewayClient is NOT a public API (only `.`, `./plugin-sdk`, `./cli-entry`)

### Secondary (MEDIUM confidence)
- `/Users/andrew/git/openclaw/src/gateway/server-methods-list.ts` -- confirmed chat.send is a registered gateway method

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- ws is the only external dependency; gateway protocol fully documented from source
- Architecture: HIGH -- Protocol flow verified from server handler, TUI client, and ACP translator. Three independent implementations confirm the pattern.
- Pitfalls: HIGH -- Each pitfall identified from actual code paths in the openclaw gateway

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (gateway protocol is stable; changes would be versioned)
