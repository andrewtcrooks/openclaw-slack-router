---
phase: 1
slug: slack-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (matching openclaw ecosystem) |
| **Config file** | vitest.config.ts — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | CFG-02 | unit | `npx vitest run src/config.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | CFG-01, CFG-02 | unit | `npx vitest run src/config.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | SLACK-04, SLACK-05 | integration | `npx vitest run src/app.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | SLACK-01, SLACK-02 | manual | N/A | N/A | ⬜ pending |
| 1-01-05 | 01 | 2 | SLACK-03 | manual | N/A | N/A | ⬜ pending |
| 1-01-06 | 01 | 2 | SLACK-06 | unit | `npx vitest run src/app.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/config.test.ts` — stubs for CFG-01, CFG-02 (env var loading and validation)
- [ ] `src/app.test.ts` — stubs for SLACK-03, SLACK-05, SLACK-06 (app creation, thread reply shape)
- [ ] `vitest.config.ts` — test framework config
- [ ] `package.json` with vitest devDependency — Wave 0 scaffold task installs this

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rook replies in Slack thread to @mention | SLACK-01, SLACK-03 | Requires live Slack workspace connection | Mention @Rook in a channel; verify reply appears in thread |
| Rook replies to DM | SLACK-02 | Requires live Slack workspace connection | DM @Rook; verify reply appears in DM thread |
| Rook joins channel when mentioned | SLACK-06 | Requires live Slack workspace connection | Mention @Rook in a channel it hasn't joined; verify it joins and replies |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
