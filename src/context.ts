import type { SubagentConfig, SubagentContext, HistoryMessage } from "./types.js";

export async function buildSubagentContext(params: {
  client: { conversations: { history: Function } };
  channelId: string;
  currentMessage: string;
  userId: string;
  threadTs: string;
  agentName: string;
  config: SubagentConfig;
  botUserId: string;
}): Promise<SubagentContext> {
  const {
    client,
    channelId,
    currentMessage,
    userId,
    threadTs,
    agentName,
    config,
    botUserId,
  } = params;

  // CTX-04: per-channel historyLimit, default 50
  const historyLimit =
    config.channels?.[channelId]?.historyLimit ?? 50;

  // CTX-01: fetch channel history (channel-scoped, not thread-scoped)
  const result = await client.conversations.history({
    channel: channelId,
    limit: historyLimit,
  });

  const rawMessages: unknown[] = result.messages ?? [];

  // CTX-02: format as HistoryMessage[]
  // conversations.history returns newest-first — reverse for chronological order
  const chronological = [...rawMessages].reverse();

  const history: HistoryMessage[] = chronological
    // filter subtype messages (channel_join, topic changes, etc.)
    // also filter messages with no text content
    .filter(
      (msg: any): msg is Record<string, unknown> =>
        !msg.subtype && Boolean(msg.text),
    )
    .map((msg: any): HistoryMessage => {
      // Bot messages have bot_id field; also match own botUserId as fallback
      const isBot =
        Boolean(msg.bot_id) ||
        (botUserId ? msg.user === botUserId : false);
      return {
        role: isBot ? "assistant" : "user",
        content: msg.text as string,
      };
    });

  return {
    channelId,
    userId,
    threadTs,
    currentMessage,
    threadHistory: history,
    agentName,
  };
}
