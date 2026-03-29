# Phase 2: Message Router + Context Gooping - Research

**Researched:** 2026-03-29
**Domain:** Slack message routing, conversations.history API, LLM context formatting
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing stub event handlers into a functional message router with channel history context. The core work is: (1) parse an incoming message to determine which subagent to dispatch to, (2) fetch the channel's message history via `conversations.history`, (3) format that history as `{role, content}[]` for LLM consumption, and (4) pass the assembled context to a subagent dispatch function (the actual subagent interface is Phase 3 -- Phase 2 builds the router and context, not the subagent execution).

The Slack `conversations.history` API is well-understood and the reference codebase at `/Users/andrew/git/openclaw/src/slack/actions.ts` demonstrates the exact call pattern. The key parameters are `channel` (required) and `limit` (controls how many messages to fetch, max 999, default 100). Messages are returned newest-first, so they must be reversed for chronological LLM context. Bot messages are identifiable by the `bot_id` field on the message object -- messages with `bot_id` map to `role: "assistant"`, messages with `user` (and no `bot_id`) map to `role: "user"`.

**Primary recommendation:** Build three distinct modules: (1) a `parseCommand` function that extracts the subagent name and cleaned message text from the raw Slack event text, (2) a `fetchChannelHistory` function that calls `conversations.history` and formats the result as `{role, content}[]`, and (3) a `routeMessage` function that ties them together -- looks up the subagent in the routing table, assembles the `SubagentContext`, and calls the dispatch function. The existing event handlers become thin wrappers that call `routeMessage`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | Each incoming message is dispatched to a specific named subagent | `parseCommand` extracts agent name from message prefix; `routeMessage` looks up agent in `SubagentConfig.agents` |
| ROUTE-02 | Users can explicitly select a subagent via message prefix | Parse `<@BOT_ID> /agentname message` or `<@BOT_ID> agentname: message` from event.text |
| ROUTE-03 | Routing configuration maps identifiers to subagent definitions | Already have `SubagentConfig` type and `subagent-config.json` from Phase 1; extend with `historyLimit` |
| ROUTE-04 | Unknown/unmatched messages fall back to a default subagent | `SubagentConfig.defaultAgent` field already exists; router uses it when no prefix match found |
| CTX-01 | Full channel history is fetched via `conversations.history` before every subagent call | `client.conversations.history({ channel, limit })` call in `fetchChannelHistory` module |
| CTX-02 | Channel history formatted as `{role, content}[]` | Map messages: `bot_id` present = assistant, else = user; reverse array for chronological order |
| CTX-03 | Each Slack channel is isolated context | `conversations.history` is inherently channel-scoped (takes `channel` param); no cross-channel data possible |
| CTX-04 | History fetch limit is configurable per channel | Add optional `channelConfig` to subagent-config.json or a separate mapping; default to 50 |
| CHAN-01 | Each project gets its own Slack channel | Architectural decision already made; no code needed -- just documentation |
| CHAN-02 | Rook replies in-thread, but context is always full channel history | Event handlers reply with `thread_ts`; `fetchChannelHistory` calls `conversations.history` (channel-level, not thread-level) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @slack/bolt | 4.6.0 | WebClient for conversations.history, event handling | Already installed; `client.conversations.history()` is the API |
| zod | 3.24.x | Validate subagent-config.json with routing + channel config | Already installed; extend existing schema |

### Supporting
No new dependencies needed. All functionality is built on top of `@slack/bolt`'s `WebClient` (available as `client` in event handlers) and existing project infrastructure.

**No new packages to install for Phase 2.**

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)
```
src/
├── router/
│   ├── parse-command.ts     # Extract agent name + clean message from raw text
│   ├── parse-command.test.ts
│   ├── fetch-history.ts     # conversations.history call + format as {role,content}[]
│   ├── fetch-history.test.ts
│   ├── route-message.ts     # Orchestrator: parse -> fetch -> build context -> dispatch
│   └── route-message.test.ts
├── types.ts                 # Extended: HistoryMessage, SubagentContext, ChannelConfig
├── config.ts                # Extended: loadSubagentConfig validates with zod (adds channelConfig)
├── events/
│   ├── app-mention.ts       # Modified: call routeMessage instead of stub reply
│   └── message.ts           # Modified: call routeMessage instead of stub reply
└── ...existing files...
```

### Pattern 1: Command Parsing from Slack Mention Text
**What:** When a user mentions the bot, Slack delivers `event.text` in the format `<@U0BOT_ID> rest of message`. The parser strips the mention, then checks for an explicit agent prefix.
**When to use:** Every incoming message in both app_mention and DM handlers.
**Example:**
```typescript
// src/router/parse-command.ts

export interface ParsedCommand {
  agentName: string | null;  // null = use default agent
  message: string;           // cleaned message (no bot mention, no prefix)
}

// Slack encodes mentions as <@UXXXXXX>
const MENTION_RE = /^<@[A-Z0-9]+>\s*/;

// Supported prefix formats:
//   /agentname message body
//   agentname: message body
const SLASH_PREFIX_RE = /^\/(\w+)\s+([\s\S]*)$/;
const COLON_PREFIX_RE = /^(\w+):\s+([\s\S]*)$/;

export function parseCommand(rawText: string): ParsedCommand {
  // Strip bot mention (present in app_mention events, absent in DMs)
  const text = rawText.replace(MENTION_RE, "").trim();

  // Try /agentname format first
  const slashMatch = text.match(SLASH_PREFIX_RE);
  if (slashMatch) {
    return { agentName: slashMatch[1].toLowerCase(), message: slashMatch[2].trim() };
  }

  // Try agentname: format
  const colonMatch = text.match(COLON_PREFIX_RE);
  if (colonMatch) {
    return { agentName: colonMatch[1].toLowerCase(), message: colonMatch[2].trim() };
  }

  // No prefix -- default agent
  return { agentName: null, message: text };
}
```

### Pattern 2: Channel History Fetching + Formatting
**What:** Call `conversations.history` with the channel ID and a configurable limit, then transform the message array into `{role, content}[]` suitable for LLM context.
**When to use:** Before every subagent dispatch.
**Example:**
```typescript
// src/router/fetch-history.ts

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function fetchChannelHistory(
  client: { conversations: { history: Function } },
  channelId: string,
  limit: number = 50,
  botUserId?: string,
): Promise<HistoryMessage[]> {
  const result = await client.conversations.history({
    channel: channelId,
    limit,
  });

  const messages = result.messages ?? [];

  // conversations.history returns newest-first; reverse for chronological order
  const chronological = [...messages].reverse();

  return chronological
    .filter((msg: any) => msg.text && !msg.subtype) // Skip system messages (joins, topic changes, etc.)
    .map((msg: any): HistoryMessage => {
      // Bot messages have bot_id field; alternatively match on botUserId
      const isBot = Boolean(msg.bot_id) || (botUserId && msg.user === botUserId);
      return {
        role: isBot ? "assistant" : "user",
        content: msg.text,
      };
    });
}
```

### Pattern 3: Route Message Orchestration
**What:** The central dispatch function that ties parsing, history fetching, and agent lookup together.
**When to use:** Called from both event handlers.
**Example:**
```typescript
// src/router/route-message.ts

import { parseCommand } from "./parse-command.js";
import { fetchChannelHistory } from "./fetch-history.js";
import type { SubagentConfig } from "../types.js";

export interface SubagentContext {
  agentName: string;
  channelId: string;
  userId: string;
  threadTs: string;
  currentMessage: string;
  history: HistoryMessage[];
}

export async function routeMessage(opts: {
  text: string;
  channelId: string;
  userId: string;
  threadTs: string;
  client: any;
  config: SubagentConfig;
  botUserId?: string;
}): Promise<SubagentContext> {
  const { text, channelId, userId, threadTs, client, config, botUserId } = opts;

  // 1. Parse command
  const parsed = parseCommand(text);

  // 2. Resolve agent name
  const agentName = parsed.agentName ?? config.defaultAgent;
  const agent = config.agents[agentName];

  if (!agent) {
    // Unknown agent -- could throw or return error context
    throw new UnknownAgentError(agentName, Object.keys(config.agents));
  }

  // 3. Fetch channel history with per-channel limit
  const historyLimit = config.channelConfig?.[channelId]?.historyLimit ?? 50;
  const history = await fetchChannelHistory(client, channelId, historyLimit, botUserId);

  // 4. Build context
  return {
    agentName,
    channelId,
    userId,
    threadTs,
    currentMessage: parsed.message,
    history,
  };
}
```

### Pattern 4: Event Handler Transformation
**What:** The existing stub handlers are modified to call `routeMessage` and post the result.
**When to use:** This is the integration point where Phase 1 handlers become Phase 2 routers.
**Example:**
```typescript
// src/events/app-mention.ts (modified)
export function registerAppMentionHandler(app: any, config: SubagentConfig): void {
  app.event("app_mention", async ({ event, client, say }: any) => {
    try {
      await client.conversations.join({ channel: event.channel });
    } catch { /* already joined or private */ }

    const threadTs = resolveThreadTs(event);
    const context = await routeMessage({
      text: event.text,
      channelId: event.channel,
      userId: event.user,
      threadTs,
      client,
      config,
    });

    // Phase 2: stub dispatch -- just echo the parsed context
    // Phase 3 replaces this with actual subagent execution
    await say({
      text: `[${context.agentName}] ${context.currentMessage}`,
      thread_ts: threadTs,
    });
  });
}
```

### Anti-Patterns to Avoid
- **Fetching thread replies instead of channel history:** Use `conversations.history` (channel-level), NOT `conversations.replies` (thread-level). The architectural decision is channel = context boundary, not thread.
- **Not reversing the message array:** `conversations.history` returns newest-first. LLM context must be chronological (oldest-first). Always reverse.
- **Hardcoding the history limit:** Always read from config. Different channels may need different limits (a busy channel vs a quiet one).
- **Coupling the router to the subagent execution:** Phase 2 builds the context and identifies the agent. Phase 3 builds the execution interface. Keep them decoupled -- `routeMessage` returns a `SubagentContext`, it does not call the agent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slack mention parsing | Custom string splitting | Regex on `<@UXXXX>` format | Slack's mention format is stable and well-defined |
| Channel history pagination | Manual cursor management | Single `conversations.history` call with `limit` | For v1, a single call with `limit: 50` is sufficient; pagination adds complexity for marginal benefit |
| Rate limit handling | Manual retry/backoff | `@slack/bolt`'s built-in WebClient retry | WebClient already handles 429 responses with Retry-After headers |
| Message type detection | Parsing message subtypes | Check `bot_id` field presence | `bot_id` is the canonical way to identify bot messages |
| Bot self-ID resolution | Hardcoded bot user ID | `auth.test` API call at startup | Returns `user_id` and `bot_id` for the authenticated token |

**Key insight:** The `WebClient` bundled with `@slack/bolt` already handles rate limiting, retries, and authentication. The router is pure business logic on top of a reliable API client.

## Common Pitfalls

### Pitfall 1: conversations.history Returns Newest-First
**What goes wrong:** LLM receives context in reverse chronological order, producing incoherent responses.
**Why it happens:** Slack API returns most recent messages first by default.
**How to avoid:** Always `[...messages].reverse()` before formatting for LLM context.
**Warning signs:** LLM responses that seem to reference future messages or are confused about conversation flow.

### Pitfall 2: System/Join Messages in History
**What goes wrong:** LLM context includes "User joined the channel" and "Channel topic was set" noise.
**Why it happens:** `conversations.history` returns ALL messages including system subtypes.
**How to avoid:** Filter out messages with `subtype` field set (e.g., `channel_join`, `channel_topic`, `channel_purpose`, `bot_add`). Only keep messages where `subtype` is undefined/null.
**Warning signs:** LLM trying to respond to "X has joined the channel" messages.

### Pitfall 3: Mention Format Includes Bot ID, Not Display Name
**What goes wrong:** Message text contains `<@U0BOT_ID> /research do this` not `@rook /research do this`. Parsing fails if expecting display name.
**Why it happens:** Slack encodes all mentions as `<@USER_ID>` in the raw text field.
**How to avoid:** Strip mentions using regex `/^<@[A-Z0-9]+>\s*/` -- do NOT try to match by bot name.
**Warning signs:** Command parsing never matching because it is looking for `@rook` instead of `<@U123>`.

### Pitfall 4: Rate Limits on conversations.history (Tier 3)
**What goes wrong:** API calls start failing with 429 errors in a busy channel.
**Why it happens:** For internal apps, `conversations.history` is Tier 3 (~50 requests/minute/workspace). In a busy workspace with multiple channels, this limit can be hit. For non-Marketplace distributed apps, the limit is 1 request/minute as of March 2026.
**How to avoid:** (1) Confirm this is an internal app (not distributed), which gets Tier 3 limits. (2) The built-in WebClient retry handles 429s automatically. (3) For v1, 50 req/min is more than sufficient. (4) Future optimization: cache recent history with TTL.
**Warning signs:** Slack API returning 429 Too Many Requests errors.

### Pitfall 5: DM Messages Have No Bot Mention Prefix
**What goes wrong:** `parseCommand` fails because DM messages don't start with `<@BOT_ID>`.
**Why it happens:** In DMs, Slack doesn't include the mention in `event.text` -- the user just types the message directly.
**How to avoid:** The mention-stripping regex must be tolerant of no match (it is -- `replace` returns the original string if no match). Ensure `parseCommand` works correctly whether or not a mention is present.
**Warning signs:** Agent prefix parsing broken in DMs but working in channels.

### Pitfall 6: Empty Channel History on First Message
**What goes wrong:** `conversations.history` returns only the current message (or nothing useful) when a channel is brand new.
**Why it happens:** New channels have no prior messages. The current message may or may not be included depending on timing.
**How to avoid:** Handle empty history gracefully -- `history: []` is a valid context for a subagent (first message in channel).
**Warning signs:** Null/undefined errors when history array is empty.

## Code Examples

### conversations.history Call Signature (from reference codebase)
```typescript
// Source: /Users/andrew/git/openclaw/src/slack/actions.ts lines 226-231
const result = await client.conversations.history({
  channel: channelId,
  limit: opts.limit,   // max 999, default 100 (was reduced to 15 for non-Marketplace apps in 2025)
  latest: opts.before, // Unix timestamp upper bound (optional)
  oldest: opts.after,  // Unix timestamp lower bound (optional)
});
// result.messages: Array<{ ts, text, user?, bot_id?, subtype?, thread_ts?, ... }>
// result.has_more: boolean
```

### Slack Message Object Shape (from conversations.history response)
```typescript
// Based on reference codebase types + official docs
interface SlackHistoryMessage {
  type: "message";
  ts: string;                    // Message timestamp (unique ID)
  text?: string;                 // Message text content
  user?: string;                 // User ID (present for human messages)
  bot_id?: string;               // Bot ID (present for bot messages)
  subtype?: string;              // System message type (channel_join, channel_topic, etc.)
  thread_ts?: string;            // Thread parent timestamp (if in a thread)
  reply_count?: number;          // Number of thread replies
  reactions?: Array<{ name: string; count: number; users: string[] }>;
}
```

### Bot Self-Identification via auth.test
```typescript
// Call once at startup to get the bot's own user ID
// Source: Slack API docs - auth.test method
const authResult = await client.auth.test();
const botUserId = authResult.user_id;  // e.g., "U0BOT123"
const botId = authResult.bot_id;       // e.g., "B0BOT456"
// Use botUserId to identify own messages in conversations.history
```

### SubagentContext Type (for Phase 3 consumption)
```typescript
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SubagentContext {
  agentName: string;         // Resolved agent name from routing table
  channelId: string;         // Slack channel ID
  userId: string;            // Requesting user's Slack ID
  threadTs: string;          // Thread to reply in
  currentMessage: string;    // Cleaned current message (no mention prefix, no agent prefix)
  history: HistoryMessage[]; // Channel history formatted for LLM
}
```

### Extended subagent-config.json Schema
```json
{
  "defaultAgent": "echo",
  "agents": {
    "echo": {
      "name": "echo",
      "description": "Echoes back the user's message (placeholder)"
    },
    "research": {
      "name": "research",
      "description": "Research agent for deep investigation"
    }
  },
  "channelConfig": {
    "C_OPENCLAW_CHANNEL_ID": {
      "historyLimit": 100
    },
    "C_DATANOVA_CHANNEL_ID": {
      "historyLimit": 50
    }
  }
}
```

### Error Handling for Unknown Agents
```typescript
export class UnknownAgentError extends Error {
  constructor(
    public readonly requestedAgent: string,
    public readonly availableAgents: string[],
  ) {
    super(
      `Unknown agent "${requestedAgent}". Available agents: ${availableAgents.join(", ")}`,
    );
    this.name = "UnknownAgentError";
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| conversations.history default limit 100 | Default reduced to 15 for non-Marketplace apps | May 2025 | Internal apps still get default 100; but always pass explicit `limit` param |
| No rate limit distinction | Tier 3 for internal, 1/min for non-Marketplace distributed | March 2026 | Must confirm app is internal to get 50 req/min |
| Thread-based context | Channel-based context | Project decision | Use `conversations.history` (channel), NOT `conversations.replies` (thread) |

**Deprecated/outdated:**
- Thread-based context isolation: This project explicitly chose channel = context boundary. Do NOT use thread history.
- `conversations.history` without explicit `limit`: Always pass `limit` explicitly to avoid relying on defaults that may change.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | vitest.config.ts (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | parseCommand extracts agent name; routeMessage dispatches to named agent | unit | `npx vitest run src/router/parse-command.test.ts src/router/route-message.test.ts` | No -- Wave 0 |
| ROUTE-02 | parseCommand handles `/agent msg` and `agent: msg` formats | unit | `npx vitest run src/router/parse-command.test.ts` | No -- Wave 0 |
| ROUTE-03 | loadSubagentConfig validates routing table with agents + channelConfig | unit | `npx vitest run src/config.test.ts -t "subagent"` | Partial (exists but needs extension) |
| ROUTE-04 | routeMessage falls back to defaultAgent when no prefix | unit | `npx vitest run src/router/route-message.test.ts -t "default"` | No -- Wave 0 |
| CTX-01 | fetchChannelHistory calls conversations.history with correct params | unit | `npx vitest run src/router/fetch-history.test.ts -t "history"` | No -- Wave 0 |
| CTX-02 | fetchChannelHistory formats messages as {role, content}[] | unit | `npx vitest run src/router/fetch-history.test.ts -t "format"` | No -- Wave 0 |
| CTX-03 | Channel isolation (inherent in API -- test that channel param is passed) | unit | `npx vitest run src/router/fetch-history.test.ts -t "channel"` | No -- Wave 0 |
| CTX-04 | historyLimit read from channelConfig per channel | unit | `npx vitest run src/router/route-message.test.ts -t "historyLimit"` | No -- Wave 0 |
| CHAN-01 | Architectural (no code test needed) | manual-only | N/A | N/A |
| CHAN-02 | Event handler replies in-thread but routeMessage uses channel history | unit | `npx vitest run src/router/route-message.test.ts -t "channel history"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/router/parse-command.test.ts` -- covers ROUTE-01, ROUTE-02
- [ ] `src/router/fetch-history.test.ts` -- covers CTX-01, CTX-02, CTX-03
- [ ] `src/router/route-message.test.ts` -- covers ROUTE-01, ROUTE-04, CTX-04, CHAN-02
- [ ] Extend `src/config.test.ts` -- covers ROUTE-03 (channelConfig validation)
- [ ] Update `src/events/app-mention.test.ts` -- covers modified handler calling routeMessage
- [ ] Update `src/events/message.test.ts` -- covers modified handler calling routeMessage

### Testing Strategy Note
Mock `client.conversations.history` as a vi.fn() returning `{ messages: [...], has_more: false }`. The existing test pattern (see `src/events/app-mention.test.ts`) already mocks `client.conversations.join` this way -- extend the same mock object with a `history` method. The `parseCommand` tests are pure functions with no mocks needed.

## Open Questions

1. **Bot user ID resolution at startup**
   - What we know: `auth.test` returns the bot's `user_id` and `bot_id`. This is needed to identify own messages in history as "assistant" role.
   - What's unclear: Whether to call `auth.test` once at startup and thread the result through, or call it in each handler invocation.
   - Recommendation: Call `auth.test` once at startup in `index.ts`, store the `botUserId` on the config/app context, and pass it to `routeMessage`. Avoid calling it per-message.

2. **History limit default value**
   - What we know: Slack default is 100 for internal apps. The project needs a sensible default when no per-channel config exists.
   - What's unclear: Optimal default for LLM context (token budget varies by model).
   - Recommendation: Default to 50 messages. This is a reasonable balance between context richness and token cost. Users can override per channel in `channelConfig`.

3. **Subagent dispatch stub for Phase 2**
   - What we know: Phase 2 builds the router + context, Phase 3 builds the subagent interface.
   - What's unclear: What should the Phase 2 "dispatch" do since real subagents don't exist yet?
   - Recommendation: Phase 2 ends with `routeMessage` returning a `SubagentContext`. The event handler posts a formatted debug message like `[agentName] message (N history messages)` to confirm routing works. Phase 3 replaces this with real execution.

## Sources

### Primary (HIGH confidence)
- Reference codebase `/Users/andrew/git/openclaw/src/slack/actions.ts` -- proven `conversations.history` call pattern, message type structure, pagination handling
- Reference codebase `/Users/andrew/git/openclaw/src/slack/types.ts` -- `SlackMessageEvent` type with `bot_id`, `user`, `subtype` fields
- [Slack official docs: conversations.history](https://docs.slack.dev/reference/methods/conversations.history/) -- parameters, response shape, rate limits, required scopes
- [Slack official docs: auth.test](https://docs.slack.dev/reference/methods/auth.test/) -- bot self-identification
- Existing project code at `/Users/andrew/git/openclaw-slack-router/src/` -- Phase 1 patterns, test mocking approach, ESM/CJS interop

### Secondary (MEDIUM confidence)
- [Slack rate limits documentation](https://docs.slack.dev/apis/web-api/rate-limits/) -- Tier 3 = 50 req/min for internal apps
- [Slack rate limit changes for non-Marketplace apps](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/) -- 1 req/min for distributed non-Marketplace apps, March 2026 enforcement
- [Slack message formatting docs](https://docs.slack.dev/messaging/formatting-message-text/) -- `<@USER_ID>` mention format

### Tertiary (LOW confidence)
- None -- all findings verified against official docs and reference codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all patterns from Phase 1 + reference codebase
- Architecture: HIGH -- `conversations.history` API is well-documented, reference codebase demonstrates exact pattern, message parsing is straightforward regex
- Pitfalls: HIGH -- rate limits verified against current (March 2026) official docs; message format confirmed from reference codebase types

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable domain; Slack API is mature)
