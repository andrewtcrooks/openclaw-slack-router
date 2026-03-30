---
phase: 03-subagent-interface-first-real-subagent
plan: 01
subsystem: api
tags: [typescript, subagent, registry, dispatch, websocket]

requires:
  - phase: 02-message-router-context-gooping
    provides: event handlers with stub dispatch, buildSubagentContext, resolveRoute

provides:
  - SubagentDefinition interface (name, description, handle)
  - SubagentRegistry type (Record<string, SubagentDefinition>)
  - buildSubagentRegistry factory function
  - Registry-based dispatch in event handlers
  - SubagentContext.threadHistory field (renamed from .history)
  - ws dependency installed for WebSocket subagent communication

affects: [03-02-openclaw-gateway-subagent]

tech-stack:
  added: [ws]
  patterns: [registry-based dispatch, subagent interface contract]

key-files:
  created:
    - src/subagents/types.ts
    - src/subagents/index.ts
    - src/subagents/index.test.ts
  modified:
    - src/types.ts
    - src/context.ts
    - src/context.test.ts
    - src/events/app-mention.ts
    - src/events/app-mention.test.ts
    - src/events/message.ts
    - src/events/message.test.ts
    - src/app.ts
    - src/app.test.ts
    - src/index.ts
    - package.json

key-decisions:
  - "SubagentDefinition.handle returns Promise<string> — simple text response contract"
  - "Registry miss returns user-facing error instead of throwing — graceful degradation"
  - "OPENCLAW_GATEWAY_URL defaults to ws://127.0.0.1:18789 for local dev"

patterns-established:
  - "SubagentDefinition interface: all subagents implement name/description/handle(ctx)"
  - "Registry-based dispatch: event handlers look up subagent by agentName in registry"
  - "Registry miss handling: 'No subagent implementation registered' message to user"

requirements-completed: [AGENT-01, AGENT-02, AGENT-03]

duration: 4min
completed: 2026-03-30
---

# Phase 3 Plan 1: Subagent Interface and Registry Summary

**SubagentDefinition interface with registry-based dispatch replacing stub say() in event handlers, plus threadHistory rename**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T18:32:23Z
- **Completed:** 2026-03-30T18:37:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Defined SubagentDefinition interface (name, description, handle) as the universal subagent contract
- Created SubagentRegistry type and buildSubagentRegistry factory for Plan 02 to populate
- Replaced stub dispatch in both event handlers with real registry-based subagent.handle() calls
- Renamed SubagentContext.history to threadHistory across all source and test files
- Installed ws dependency for WebSocket-based subagent communication in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Define SubagentDefinition interface, rename history to threadHistory, create registry skeleton** - `6793e85` (feat)
2. **Task 2: Wire SubagentRegistry into event handlers, createApp, and entry point** - `42ef6f9` (feat)

## Files Created/Modified
- `src/subagents/types.ts` - SubagentDefinition interface
- `src/subagents/index.ts` - SubagentRegistry type and buildSubagentRegistry factory
- `src/subagents/index.test.ts` - Registry type conformance tests
- `src/types.ts` - Renamed SubagentContext.history to threadHistory
- `src/context.ts` - Updated return object to use threadHistory property
- `src/context.test.ts` - Updated all .history references to .threadHistory
- `src/events/app-mention.ts` - Registry-based dispatch, SubagentRegistry parameter
- `src/events/app-mention.test.ts` - Mock registry, handle() verification, registry miss test
- `src/events/message.ts` - Registry-based dispatch, SubagentRegistry parameter
- `src/events/message.test.ts` - Mock registry, handle() verification, registry miss test
- `src/app.ts` - createApp accepts SubagentRegistry as 4th parameter
- `src/app.test.ts` - Updated for new createApp signature
- `src/index.ts` - buildSubagentRegistry call with OPENCLAW_GATEWAY_URL env var
- `package.json` - Added ws dependency

## Decisions Made
- SubagentDefinition.handle returns Promise<string> for simple text response contract
- Registry miss returns user-facing error message instead of throwing, for graceful degradation
- OPENCLAW_GATEWAY_URL env var defaults to ws://127.0.0.1:18789 for local development

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated app.test.ts for new createApp signature**
- **Found during:** Task 2 (wiring SubagentRegistry)
- **Issue:** app.test.ts called createApp with 3 args but signature now requires 4 (SubagentRegistry added)
- **Fix:** Added SubagentRegistry import and empty registry to all createApp calls in app.test.ts
- **Files modified:** src/app.test.ts
- **Verification:** npx tsc --noEmit passes, all tests pass
- **Committed in:** 42ef6f9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SubagentDefinition interface ready for Plan 02 to implement concrete openclaw-gateway subagent
- buildSubagentRegistry factory ready to be populated with WebSocket-based subagent
- ws dependency installed for WebSocket communication
- OPENCLAW_GATEWAY_URL env var wired into entry point

## Self-Check: PASSED

- All 14 files verified present on disk
- Commit 6793e85 (Task 1) verified in git log
- Commit 42ef6f9 (Task 2) verified in git log
- 49/49 tests passing
- TypeScript compiles clean (tsc --noEmit exits 0)

---
*Phase: 03-subagent-interface-first-real-subagent*
*Completed: 2026-03-30*
