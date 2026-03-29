# Requirements: openclaw-slack-router

**Defined:** 2026-03-27
**Core Value:** Any message sent to Rook in Slack reaches the right subagent with full thread context

## v1 Requirements

### Slack Integration

- [x] **SLACK-01**: Rook receives app mentions in public channels it has joined
- [x] **SLACK-02**: Rook receives direct messages from users
- [x] **SLACK-03**: Rook replies within the Slack thread of the triggering message
- [x] **SLACK-04**: Bot token and app token are loaded from environment variables
- [x] **SLACK-05**: Service operates in Socket Mode (no public webhook endpoint required)
- [x] **SLACK-06**: Rook can join public channels on demand

### Routing

- [ ] **ROUTE-01**: Each incoming message is dispatched to a specific named subagent
- [ ] **ROUTE-02**: Users can explicitly select a subagent via slash command or message prefix
- [ ] **ROUTE-03**: Routing configuration maps identifiers to subagent definitions
- [ ] **ROUTE-04**: Unknown/unmatched messages fall back to a default subagent

### Context Management

- [ ] **CTX-01**: Full channel history is fetched via `conversations.history` before every subagent call
- [ ] **CTX-02**: Channel history is formatted as `{role, content}[]` and included as conversation context in the subagent call
- [ ] **CTX-03**: Each Slack channel is an isolated context — history from one channel never appears in another channel's calls
- [ ] **CTX-04**: History fetch limit is configurable per channel (maps to `historyLimit` in config)

### Channel Management

- [ ] **CHAN-01**: Each project gets its own Slack channel (e.g., #rook-openclaw, #rook-datanova)
- [ ] **CHAN-02**: Rook replies in-thread within a channel (keeps channel readable), but the context sent to the subagent is always the full channel history — not thread replies only

### Subagent Interface

- [ ] **AGENT-01**: Subagents are defined as TypeScript modules with a standard interface
- [ ] **AGENT-02**: Each subagent receives: thread history, current message, and metadata (user, channel, thread_ts)
- [ ] **AGENT-03**: Subagent responses are posted back to the Slack thread

### Configuration

- [x] **CFG-01**: Subagent routing table is defined in a config file (not hardcoded)
- [x] **CFG-02**: Service reads SLACK_BOT_TOKEN and SLACK_APP_TOKEN from env

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
| SLACK-01 | Phase 1 | Complete |
| SLACK-02 | Phase 1 | Complete |
| SLACK-03 | Phase 1 | Complete |
| SLACK-04 | Phase 1 | Complete |
| SLACK-05 | Phase 1 | Complete |
| SLACK-06 | Phase 1 | Complete |
| CFG-01 | Phase 1 | Complete |
| CFG-02 | Phase 1 | Complete |
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
*Last updated: 2026-03-29 after 01-02 completion*
