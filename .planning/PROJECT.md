# openclaw-slack-router

## What This Is

A Slack-based message router for the Rook agent that receives messages via Slack and dispatches them to the appropriate subagent (rather than making a single monolithic LLM call). Users interact with Rook through Slack channels and threads; Rook routes each message to a specialized subagent based on intent, and sends the response back into the thread.

## Core Value

Any message sent to Rook in Slack reaches the right subagent with full thread context — so every call is informed by the complete conversation history.

## Requirements

### Validated

(None yet — ship to validate)

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
- **Context strategy**: The full Slack thread history is fetched and included in every subagent call — stateless calls with full context each time.
- **Thread model**: Each conversation lives in a Slack thread. Users can create new threads to start fresh conversations with different subagents.

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
| Thread = conversation unit | Each Slack thread is one conversation context | — Pending |
| Context gooping | Full thread history sent with every call, no external memory | — Pending |

---
*Last updated: 2026-03-27 after initialization*
