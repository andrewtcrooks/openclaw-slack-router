export interface SubagentEntry {
  name: string;
  description: string;
}

export interface ChannelConfig {
  historyLimit?: number;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SubagentContext {
  channelId: string;
  userId: string;
  threadTs: string;
  currentMessage: string;
  history: HistoryMessage[];
  agentName: string;
}

export interface SubagentConfig {
  defaultAgent: string;
  agents: Record<string, SubagentEntry>;
  channelConfig?: Record<string, ChannelConfig>;
}
