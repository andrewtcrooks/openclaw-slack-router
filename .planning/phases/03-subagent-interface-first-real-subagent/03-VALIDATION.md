---
phase: 3
slug: subagent-interface-first-real-subagent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | AGENT-01 | unit | `npx vitest run src/subagents/index.test.ts -x` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | — | unit | `npx vitest run src/gateway/chat-client.test.ts -x` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | AGENT-03 | unit | `npx vitest run src/subagents/openclaw-gateway.test.ts -x` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | AGENT-02 | unit | `npx vitest run src/context.test.ts -x` | ✅ (update) | ⬜ pending |
| 3-01-05 | 01 | 0 | AGENT-03 | unit | `npx vitest run src/events/app-mention.test.ts -x` | ✅ (update) | ⬜ pending |
| 3-01-06 | 01 | 0 | AGENT-03 | unit | `npx vitest run src/events/message.test.ts -x` | ✅ (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/subagents/index.test.ts` — tests registry building and agent name resolution (AGENT-01)
- [ ] `src/gateway/chat-client.test.ts` — tests WebSocket protocol flow with mock WS server (connect handshake, chat.send ack, chat event final/error)
- [ ] `src/subagents/openclaw-gateway.test.ts` — tests handle() with mocked gateway chat client
- [ ] Update `src/context.test.ts` — rename `.history` → `.threadHistory` in all assertions (AGENT-02)
- [ ] Update `src/events/app-mention.test.ts` — replace stub dispatch expectations with registry-based dispatch (AGENT-03)
- [ ] Update `src/events/message.test.ts` — same as above (AGENT-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Slack round-trip via openclaw gateway | AGENT-03 | Requires live openclaw gateway + Slack workspace | Start openclaw gateway, start Rook, @mention with prefix, verify thread reply appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
