---
phase: 2
slug: message-router-context-gooping
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (established in Phase 1) |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 0 | ROUTE-01,02,03,04 | unit | `npx vitest run src/router.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 02-01 | 1 | ROUTE-01,02,03,04 | unit | `npx vitest run src/router.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02-02 | 0 | CTX-01,02,03,04 | unit | `npx vitest run src/context.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02-02 | 1 | CTX-01,02,03,04 | unit | `npx vitest run src/context.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 02-03 | 2 | CHAN-01,02 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 2-03-02 | 02-03 | 2 | ROUTE-01,CTX-01 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/router.test.ts` — stubs for ROUTE-01 through ROUTE-04 (command parsing, dispatch, fallback, unknown agent)
- [ ] `src/context.test.ts` — stubs for CTX-01 through CTX-04 (history fetch, format, channel isolation, historyLimit)
- [ ] Wave 0 stubs are created before Wave 1 implementation begins (TDD)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@rook /research do this` dispatches to research subagent in live Slack | ROUTE-01 | Requires live Slack workspace | Mention @Rook with agent prefix; verify correct agent stub responds |
| Channel isolation in live workspace | CTX-03 | Requires 2 live channels | Post in #rook-openclaw and #rook-datanova; verify histories don't cross |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
