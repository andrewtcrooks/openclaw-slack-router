# Requirements: openclaw-slack-router

**Defined:** 2026-03-27
**Core Value:** Any message sent to Rook in Slack reaches the right subagent with full thread context

## v1 Requirements

### Slack Integration

- [ ] **SLACK-01**: Rook receives app mentions in public channels it has joined
- [ ] **SLACK-02**: Rook receives direct messages from users
- [ ] **SLACK-03**: Rook replies within the Slack thread of the triggering message
- [ ] **SLACK-04**: Bot token and app token are loaded from environment variables
- [ ] **SLACK-05**: Service operates in Socket Mode (no public webhook endpoint required)
- [ ] **SLACK-06**: Rook can join public channels on demand

### Routing

- [ ] **ROUTE-01**: Each incoming message is dispatched to a specific named subagent
- [ ] **ROUTE-02**: Users can explicitly select a subagent via slash command or message prefix
- [ ] **ROUTE-03**: Routing configuration maps identifiers to subagent definitions
- [ ] **ROUTE-04**: Unknown/unmatched messages fall back to a default subagent

### Context Management

- [ ] **CTX-01**: Full Slack thread history is fetched before every subagent call
- [ ] **CTX-02**: Thread history is formatted and included as conversation context in the subagent call
- [ ] **CTX-03**: Each Slack thread is treated as an isolated conversation (no cross-thread bleed)

### Thread Management

- [ ] **THREAD-01**: Users can start a new conversation thread via a Slack command or mention
- [ ] **THREAD-02**: Rook's responses are always posted in-thread (not as top-level channel messages)

### Subagent Interface

- [ ] **AGENT-01**: Subagents are defined as TypeScript modules with a standard interface
- [ ] **AGENT-02**: Each subagent receives: thread history, current message, and metadata (user, channel, thread_ts)
- [ ] **AGENT-03**: Subagent responses are posted back to the Slack thread

### Configuration

- [ ] **CFG-01**: Subagent routing table is defined in a config file (not hardcoded)
- [ ] **CFG-02**: Service reads SLACK_BOT_TOKEN and SLACK_APP_TOKEN from env

## v2 Requirements

### Memory

- **MEM-01**: Rook maintains a persistent memory doc per user across threads
- **MEM-02**: Memory is summarized and injected into context alongside thread history

### Advanced Routing

- **ROUTE-V2-01**: LLM-based classifier automatically determines best subagent
- **ROUTE-V2-02**: Routing can be overridden mid-thread

### Multi-workspace

- **WS-01**: Service supports multiple Slack workspaces simultaneously

## Out of Scope

| Feature | Reason |
|---------|--------|
| Telegram integration | Explicitly migrating away |
| Raw LLM passthrough | Rook routes to subagents, not bare Claude |
| Webhook mode | Socket Mode preferred; no public URL needed |
| External persistent memory | Thread history is sufficient for v1 |
| Multi-workspace | Single workspace target for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SLACK-01 | Phase 1 | Pending |
| SLACK-02 | Phase 1 | Pending |
| SLACK-03 | Phase 1 | Pending |
| SLACK-04 | Phase 1 | Pending |
| SLACK-05 | Phase 1 | Pending |
| SLACK-06 | Phase 1 | Pending |
| CFG-01 | Phase 1 | Pending |
| CFG-02 | Phase 1 | Pending |
| ROUTE-01 | Phase 2 | Pending |
| ROUTE-02 | Phase 2 | Pending |
| ROUTE-03 | Phase 2 | Pending |
| ROUTE-04 | Phase 2 | Pending |
| CTX-01 | Phase 2 | Pending |
| CTX-02 | Phase 2 | Pending |
| CTX-03 | Phase 2 | Pending |
| THREAD-01 | Phase 2 | Pending |
| THREAD-02 | Phase 2 | Pending |
| AGENT-01 | Phase 3 | Pending |
| AGENT-02 | Phase 3 | Pending |
| AGENT-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initialization*
