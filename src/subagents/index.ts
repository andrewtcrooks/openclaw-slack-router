import type { SubagentDefinition } from "./types.js";
import { createOpenclawGatewaySubagent } from "./openclaw-gateway.js";

export type SubagentRegistry = Record<string, SubagentDefinition>;

export interface RegistryOptions {
  gatewayUrl: string;
  gatewayToken?: string;
}

export function buildSubagentRegistry(options: RegistryOptions): SubagentRegistry {
  return {
    default: createOpenclawGatewaySubagent({
      gatewayUrl: options.gatewayUrl,
      gatewayToken: options.gatewayToken,
    }),
  };
}
