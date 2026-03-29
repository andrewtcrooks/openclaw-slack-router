export interface SubagentEntry {
  name: string;
  description: string;
}

export interface SubagentConfig {
  defaultAgent: string;
  agents: Record<string, SubagentEntry>;
}
