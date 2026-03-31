export interface SubagentEntry {
  name: string;
  description: string;
}

export interface ChannelEntry {
  name: string;
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
  threadHistory: HistoryMessage[];
  agentName: string;
}

export interface SubagentConfig {
  botName: string;
  mainChannelId: string | null;
  introPosted: boolean;
  defaultAgent: string;
  agents: Record<string, SubagentEntry>;
  channels: Record<string, ChannelEntry>;
}
