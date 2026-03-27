# Roadmap: openclaw-slack-router

**Milestone:** v1 — Slack-based Rook router
**Created:** 2026-03-27
**Requirements:** 20 v1 requirements across 3 phases

---

## Phase 1: Slack Foundation

**Goal:** Rook is connected to Slack in Socket Mode, can receive mentions and DMs, and replies in-thread. Credentials and config loading work correctly.

**Requirements:** SLACK-01, SLACK-02, SLACK-03, SLACK-04, SLACK-05, SLACK-06, CFG-01, CFG-02

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold, config/env validation with zod, types, subagent-config stub
- [ ] 01-02-PLAN.md — Bolt app factory, event handlers (app_mention + DM), reply helper, entry point

**Success Criteria:**
1. `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` env vars are loaded; service fails with a clear error if missing
2. Service connects to Slack via Socket Mode without a public URL
3. Mentioning @Rook in a channel produces a reply in-thread within the same thread_ts
4. A DM to Rook produces a reply in the DM thread
5. Rook joins a public channel when mentioned for the first time
6. A `subagent-config.ts` (or `.json`) file defines the routing table schema

---

## Phase 2: Message Router + Context Gooping

**Goal:** Incoming messages are routed to the correct subagent based on explicit commands or prefixes. Full Slack thread history is fetched and included in every subagent call. Each thread is an isolated conversation.

**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, CTX-01, CTX-02, CTX-03, THREAD-01, THREAD-02

**Success Criteria:**
1. `/rook <agent-name> <message>` or `@rook @agent-name <message>` dispatches to the named subagent
2. A message with no explicit subagent prefix routes to the default subagent
3. An unknown subagent name returns an informative error message in-thread
4. `channels.history` / `conversations.replies` is called before every subagent dispatch to fetch the full thread
5. Thread history is formatted as an array of `{role, content}` messages and passed to the subagent
6. Messages in thread A never appear in thread B's context
7. A user can start a new thread by posting a top-level message (not a reply)

---

## Phase 3: Subagent Interface + First Real Subagent

**Goal:** A standard TypeScript interface defines what a subagent is. At least one concrete subagent is implemented (a simple echo/pass-through or Claude API call) and wired into the router.

**Requirements:** AGENT-01, AGENT-02, AGENT-03

**Success Criteria:**
1. `SubagentDefinition` interface is exported from a shared types file with `name`, `description`, `handle(ctx: SubagentContext): Promise<string>` shape
2. `SubagentContext` includes: `threadHistory: Message[]`, `currentMessage: string`, `userId: string`, `channelId: string`, `threadTs: string`
3. At least one concrete subagent (`echo` or `claude-basic`) is implemented and registered in the routing table
4. End-to-end: mention Rook with a subagent prefix → correct subagent is called → response posted in Slack thread

---

## Requirement Traceability

| Phase | REQ-IDs |
|-------|---------|
| 1 | SLACK-01, SLACK-02, SLACK-03, SLACK-04, SLACK-05, SLACK-06, CFG-01, CFG-02 |
| 2 | ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, CTX-01, CTX-02, CTX-03, THREAD-01, THREAD-02 |
| 3 | AGENT-01, AGENT-02, AGENT-03 |

---
*Roadmap created: 2026-03-27*
