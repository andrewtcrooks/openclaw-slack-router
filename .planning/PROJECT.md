# openclaw-slack-router

## What This Is

A Slack-based message router for the Rook agent that receives messages via Slack and dispatches them to the appropriate subagent (rather than making a single monolithic LLM call). Users interact with Rook through Slack channels and threads; Rook routes each message to a specialized subagent based on intent, and sends the response back into the thread.

## Core Value

Each Slack channel is an isolated project context — messages in #rook-openclaw only see openclaw history, messages in #rook-datanova only see datanova history. No cross-project token burn, no context bleed.

## Requirements

### Validated

- ✓ SLACK-04: Bot/app tokens loaded from env with zod validation — Phase 1
- ✓ SLACK-05: Socket Mode connection (no public URL) — Phase 1
- ✓ CFG-01: Subagent routing table in config file — Phase 1
- ✓ CFG-02: SLACK_BOT_TOKEN + SLACK_APP_TOKEN from env — Phase 1

### Validated (continued)

- ✓ AGENT-01: SubagentDefinition interface + SubagentRegistry type — Phase 3
- ✓ AGENT-02: Registry-based dispatch in both event handlers — Phase 3
- ✓ AGENT-03: openclaw-gateway subagent (WebSocket protocol) registered as default — Phase 3

### Active

- [ ] Rook receives messages via Slack (mentions in channels, DMs)
- [ ] Rook replies in Slack threads (keeping conversations organized)
- [ ] Messages are routed to the correct subagent based on intent or explicit command
- [ ] Full thread history is included as context in every subagent call ("gooping")
- [ ] New threads can be created on demand for new conversations
- [ ] All Rook conversations are preserved and accessible in Slack
- [ ] Bot token and app token configured via environment variables
- [ ] Socket mode operation (no public webhook required)

### Out of Scope

- Full LLM chat passthrough — Rook routes to subagents, not raw Claude calls
- Telegram integration — explicitly migrating away from it
- Persistent external memory (beyond Slack thread history) — v2
- Multi-workspace support — single workspace for now

## Context

- **Migration**: Replacing Telegram bot with Slack; Slack provides better thread/channel management
- **Slack setup**: Workspace + app already configured. App token (xapp-) for Socket Mode, Bot token (xoxb-) for API calls.
- **OAuth scopes already enabled**: app_mentions:read, A:write (agent), channels:history, channels:join, chat:write, groups:history
- **Reference implementation**: `/Users/andrew/git/openclaw/src/slack/` shows how openclaw uses `@slack/bolt` for Slack integration — useful for patterns but this is a standalone service
- **Subagent routing**: Each message should be dispatched to a specific subagent (not a single LLM). Routing mechanism TBD (slash commands, prefixes, or LLM classifier).
- **Context strategy**: Channel history is fetched via `conversations.history` with a configurable `historyLimit` and included in every subagent call. Channel-per-project = isolated context per project. NOT thread-based — Slack thread context is unreliable (no automatic prior-history injection, known misclassification bugs).
- **Channel model**: One Slack channel per project/concern (#rook-openclaw, #rook-datanova, etc.). Threads inside a channel are disposable sub-discussions (debug, brainstorm) — not primary memory boundaries.

## Constraints

- **Tech stack**: TypeScript + Node.js — matching openclaw ecosystem
- **Slack SDK**: `@slack/bolt` — already proven in reference codebase
- **Auth**: Socket Mode (app token) preferred over webhook mode — no public URL needed
- **Standalone**: This is its own npm package/service, not a plugin inside openclaw

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Slack over Telegram | Better thread/channel UX, easier to create isolated conversations | — Pending |
| Socket Mode | No need to expose a public endpoint | — Pending |
| Channel = conversation unit | Each Slack channel is one isolated project context — not threads (thread context unreliable in Slack) | — Pending |
| Channel history gooping | Full channel history (conversations.history + historyLimit) sent with every call | — Pending |
| Threads = disposable | Threads inside channels are for lightweight sub-discussions only, not primary memory | — Pending |

---
*Last updated: 2026-03-30 after Phase 3 complete — subagent interface + openclaw-gateway dispatch working*
