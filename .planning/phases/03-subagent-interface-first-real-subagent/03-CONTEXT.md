# Phase 3: Subagent Interface + First Real Subagent — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 2 stub dispatch (`say("[agentName] message (N history msgs)")`) with:
1. A `SubagentDefinition` TypeScript interface — the contract all subagents implement
2. A concrete `openclaw-gateway` subagent — calls the locally-running openclaw gateway via `chat.send`
3. Wire the definition registry into both event handlers so real responses come back to Slack

New capabilities (new models, new agent types) belong in later phases. Phase 3 proves the end-to-end path with one working subagent.

</domain>

<decisions>
## Implementation Decisions

### SubagentDefinition Interface

- **D-01:** Interface shape: `{ name: string; description: string; handle(ctx: SubagentContext): Promise<string> }` — pure interface, no gateway config on the definition itself
- **D-02:** Openclaw gateway client and sessionKey resolution are injected at construction time (not carried on the definition)
- **D-03:** `SubagentEntry` in `types.ts` (name + description) is the config shape; `SubagentDefinition` extends it with `handle()` — they can merge or stay separate as planner decides

### SubagentContext Rename

- **D-04:** Rename `SubagentContext.history` → `SubagentContext.threadHistory` to match REQUIREMENTS.md (AGENT-02)
- **D-05:** The rename touches: `types.ts`, `context.ts`, `context.test.ts`, `events/app-mention.ts`, `events/message.ts`, and any test files that reference `.history`
- **D-06:** Do this rename in the same phase (not a separate PR) — it's a one-time cleanup before the interface becomes public

### Subagent Registration

- **D-07:** Static map pattern: `src/subagents/index.ts` exports `Record<string, SubagentDefinition>`
- **D-08:** `createApp()` receives the subagent registry map as a parameter (alongside `SubagentConfig` and `botUserId`)
- **D-09:** Adding a new subagent = create a new file in `src/subagents/`, register it in `src/subagents/index.ts`

### Openclaw Gateway Integration

- **D-10:** The first concrete subagent calls the openclaw gateway via its `callGateway` / `GatewayClient` pattern using the `chat.send` method
- **D-11:** SessionKey = `ctx.channelId` directly (e.g., `"C08ABC123"`) — stable, no lookup needed
- **D-12:** Each Slack channel maps to one openclaw session. All agent prefixes in that channel share the session. Openclaw's session config handles model selection internally.
- **D-13:** The gateway URL defaults to `ws://127.0.0.1:18789` (openclaw default). Configurable via env var `OPENCLAW_GATEWAY_URL`.
- **D-14:** The response collection pattern (how `chat.send` streams events back) needs to be researched from the openclaw gateway codebase — specifically how clients receive assistant text after a `chat.send` call.
- **D-15:** `idempotencyKey` for `chat.send` = derived from Slack `event.ts` or a UUID per dispatch

### What NOT to do in Phase 3

- Do NOT implement multiple subagent types or per-agent model config — that's later
- Do NOT replace the `SubagentConfig.agents` schema — existing config file format stays valid
- Do NOT build LLM-based routing or classifier — Phase 2 prefix routing stays

### Claude's Discretion

- Error handling for gateway failures (timeout, connection refused) — catch and return an error string
- Whether `SubagentEntry` and `SubagentDefinition` merge into one type or stay separate
- File structure inside `src/subagents/` (flat vs. subdirectory per subagent)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Openclaw Gateway Client

- `src/gateway/call.ts` — `callGateway()` / `callGatewayLeastPrivilege()` entry points; connection options
- `src/gateway/client.ts` — `GatewayClient` WebSocket client; `GatewayClientOptions` type
- `src/gateway/protocol/schema/logs-chat.ts` — `ChatSendParamsSchema` (sessionKey, message, idempotencyKey, timeoutMs)
- `src/gateway/server-methods/chat.ts` — server-side handler for `chat.send`; how responses are sent back
- `src/gateway/server-methods-list.ts` — list of available gateway methods including `chat.send`, `chat.history`, `chat.abort`

### Existing Router Codebase

- `src/types.ts` — `SubagentContext`, `SubagentEntry`, `SubagentConfig`, `HistoryMessage`
- `src/router.ts` — `resolveRoute()`, `RouteResult`, `UnknownAgentError`
- `src/context.ts` — `buildSubagentContext()` — builds `SubagentContext` from channel history
- `src/events/app-mention.ts` — Phase 2 stub dispatch (line 41-44) — this is what Phase 3 replaces
- `src/events/message.ts` — same stub dispatch for DMs

### Requirements

- `.planning/REQUIREMENTS.md` — AGENT-01, AGENT-02, AGENT-03 (the three Phase 3 requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `SubagentContext` (types.ts): already fully built — channelId, userId, threadTs, currentMessage, history (→threadHistory), agentName
- `resolveRoute()` + `buildSubagentContext()`: wired in both event handlers — Phase 3 just swaps the `say(stub)` call
- `SubagentEntry` (types.ts): has name + description — SubagentDefinition extends this with handle()

### Established Patterns

- `any` type for Bolt app param (ESM/CJS workaround) — keep this
- Vitest for tests, no mocking of external services without explicit test doubles
- Path: `src/events/`, `src/handlers/`, `src/router.ts`, `src/context.ts` — Phase 3 adds `src/subagents/`

### Integration Points

- Both `app-mention.ts` and `message.ts` have identical stub dispatch blocks — Phase 3 replaces both with `subagentRegistry[route.agentName].handle(context)`
- `createApp()` in `app.ts` is already parameterized with `SubagentConfig` and `botUserId` — add `subagentRegistry` as third param
- `index.ts` (entry point) wires everything — will need to import and pass the registry

</code_context>

<specifics>
## Specific Ideas

- Openclaw already has pro OAuth accounts configured — the gateway uses those. No API keys needed in the Slack router environment beyond `OPENCLAW_GATEWAY_URL` (and the gateway's own auth token if needed).
- The openclaw `chat.send` gateway call is how the Slack router talks to openclaw — not direct Anthropic/OpenAI SDK calls. Model selection is openclaw's responsibility.
- Phase 3 is the first "real" subagent; the pattern should be clean enough that adding `research`, `code`, `opus` agents in Phase 4 is just adding files.

</specifics>

<deferred>
## Deferred Ideas

- Multiple subagent types (research, code, opus) — Phase 4
- Per-agent model selection / openclaw session config — Phase 4
- Channel → openclaw session auto-creation if session doesn't exist — Phase 4
- LLM-based routing classifier (auto-detect which agent) — v2 (ROUTE-V2-01)

</deferred>

---

*Phase: 03-subagent-interface-first-real-subagent*
*Context gathered: 2026-03-29*
