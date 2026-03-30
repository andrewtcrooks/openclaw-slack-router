import type { SubagentDefinition } from "./types.js";

export type SubagentRegistry = Record<string, SubagentDefinition>;

export function buildSubagentRegistry(gatewayUrl: string): SubagentRegistry {
  // Phase 3 Plan 02 adds the openclaw-gateway subagent here.
  // For now, return empty registry — event handlers already have
  // fallback for missing agents.
  return {};
}
