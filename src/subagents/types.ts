import type { SubagentContext } from "../types.js";

export interface SubagentDefinition {
  name: string;
  description: string;
  handle(ctx: SubagentContext): Promise<string>;
}
