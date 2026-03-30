---
phase: 02-message-router-context-gooping
plan: "03"
subsystem: wiring
tags: [typescript, vitest, tdd, slack-bolt, event-handlers, routing]

# Dependency graph
requires:
  - phase: 02-message-router-context-gooping/02-01
    provides: resolveRoute, UnknownAgentError
  - phase: 02-message-router-context-gooping/02-02
    provides: buildSubagentContext
provides:
  - Wired event handlers calling resolveRoute + buildSubagentContext with stub dispatch
  - createApp accepting (config, subagentConfig, botUserId)
  - index.ts resolving botUserId via auth.test() at startup
  - Phase 2 end-to-end proof: routing + context gooping integrated
affects:
  - 03-xx (Phase 3 replaces stub dispatch with real subagent execution)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stub dispatch pattern: [agentName] cleaned-message (N history msgs) for Phase 2 verification"
    - "WebClient before Bolt App: resolve botUserId via auth.test() before createApp() at startup"
    - "ESM/CJS interop: same slackBoltModule pattern extended to index.ts for WebClient access"

key-files:
  created: []
  modified:
    - src/events/app-mention.ts
    - src/events/app-mention.test.ts
    - src/events/message.ts
    - src/events/message.test.ts
    - src/app.ts
    - src/app.test.ts
    - src/index.ts

key-decisions:
  - "Stub dispatch in event handlers: echoes [agentName] + cleaned-message + history count; Phase 3 replaces"
  - "botUserId resolved once at startup via WebClient.auth.test() before app creation — avoids circular dependency"
  - "WebClient imported dynamically in index.ts using same ESM/CJS interop pattern as app.ts"

requirements-completed: [CHAN-01, CHAN-02]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 2 Plan 03: Event Handler Wiring Summary

**Wired resolveRoute + buildSubagentContext into app-mention and DM handlers with stub dispatch; createApp extended with subagentConfig + botUserId; index.ts resolves botUserId via auth.test() at startup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T02:22:35Z
- **Completed:** 2026-03-30T02:24:40Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Both event handlers (`registerAppMentionHandler`, `registerMessageHandler`) now call `resolveRoute` and `buildSubagentContext`, then send a stub reply `[agentName] cleaned-message (N history msgs)` in-thread
- `UnknownAgentError` caught in both handlers — produces an in-thread error reply rather than crashing
- `createApp` signature updated from `(config)` to `(config, subagentConfig, botUserId)` — passes both to both handlers
- `index.ts` now calls `loadSubagentConfig()` and resolves `botUserId` via `WebClient.auth.test()` before creating the Bolt app
- TDD workflow: RED commit (failing tests with new expectations), then GREEN commit (implementations passing all tests)
- Full test suite: 45/45 green across all 7 test files; `tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for wired handlers** - `2b0f598` (test)
2. **Task 1 GREEN: Wire resolveRoute + buildSubagentContext into event handlers** - `4adbb54` (feat)
3. **Task 2: Wire createApp and resolve botUserId at startup** - `3cf22fb` (feat)

_TDD workflow: RED (2b0f598) then GREEN (4adbb54) for handler tests_

## Files Created/Modified

- `src/events/app-mention.ts` — Updated: imports resolveRoute, buildSubagentContext; new signature; stub dispatch
- `src/events/app-mention.test.ts` — Rewritten: 7 tests covering routing, [agentName] reply, unknown agent, history count, thread_ts
- `src/events/message.ts` — Updated: same routing wiring as app-mention for DM handler
- `src/events/message.test.ts` — Rewritten: 8 tests covering same behavior set; filter tests preserved
- `src/app.ts` — Updated: createApp now accepts (config, subagentConfig, botUserId)
- `src/app.test.ts` — Updated: createApp calls now pass subagentConfig + botUserId
- `src/index.ts` — Updated: loads subagentConfig, resolves botUserId via auth.test(), passes both to createApp

## Decisions Made

- Stub dispatch format `[agentName] currentMessage (N history msgs)` gives end-to-end proof that routing + context assembly work together without requiring real subagent execution
- `auth.test()` called via `WebClient` directly before `createApp()` — avoids circular dependency where Bolt App would need botUserId to register handlers
- Kept ESM/CJS interop pattern consistent with `app.ts`: `slackBoltModule.App ? slackBoltModule : slackBoltModule.default`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TDD flow clean: RED confirmed with 8 failures, GREEN confirmed with 45/45 passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 complete: routing (02-01), context gooping (02-02), and wiring (02-03) all done
- Phase 3 entry point: replace stub dispatch in `app-mention.ts` and `message.ts` with real subagent execution calls
- All 45 tests passing; codebase in clean state for Phase 3 work

---
*Phase: 02-message-router-context-gooping*
*Completed: 2026-03-30*

## Self-Check: PASSED

- src/events/app-mention.ts: FOUND
- src/events/message.ts: FOUND
- src/app.ts: FOUND
- src/index.ts: FOUND
- .planning/phases/02-message-router-context-gooping/02-03-SUMMARY.md: FOUND
- Commit 2b0f598 (test RED): FOUND
- Commit 4adbb54 (feat GREEN handlers): FOUND
- Commit 3cf22fb (feat app factory + entry point): FOUND
