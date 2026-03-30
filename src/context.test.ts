import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSubagentContext } from "./context.js";
import type { SubagentConfig } from "./types.js";

const config: SubagentConfig = {
  defaultAgent: "echo",
  agents: { echo: { name: "echo", description: "Echo" } },
};

const BOT_USER_ID = "UBOT123";

function makeClient(messages: unknown[]) {
  return {
    conversations: {
      history: vi.fn().mockResolvedValue({ messages, has_more: false }),
    },
  };
}

const baseParams = {
  channelId: "C123",
  currentMessage: "hello world",
  userId: "U456",
  threadTs: "1234.5678",
  agentName: "echo",
  config,
  botUserId: BOT_USER_ID,
};

describe("buildSubagentContext", () => {
  it("calls conversations.history with correct channelId and default limit 50", async () => {
    const client = makeClient([]);
    await buildSubagentContext({ ...baseParams, client });
    expect(client.conversations.history).toHaveBeenCalledWith({
      channel: "C123",
      limit: 50,
    });
  });

  it("calls conversations.history with per-channel historyLimit from config.channelConfig", async () => {
    const client = makeClient([]);
    const configWithLimit: SubagentConfig = {
      ...config,
      channelConfig: { C123: { historyLimit: 25 } },
    };
    await buildSubagentContext({ ...baseParams, client, config: configWithLimit });
    expect(client.conversations.history).toHaveBeenCalledWith({
      channel: "C123",
      limit: 25,
    });
  });

  it("returns empty history array when no messages returned", async () => {
    const client = makeClient([]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.history).toEqual([]);
  });

  it("filters out messages with subtype field", async () => {
    const client = makeClient([
      { ts: "1", text: "hello", user: "U100" },
      { ts: "2", text: "joined", user: "U200", subtype: "channel_join" },
      { ts: "3", text: "world", user: "U300" },
    ]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.history).toHaveLength(2);
    expect(result.history.every((m) => m.content !== "joined")).toBe(true);
  });

  it("maps bot_id messages to role: 'assistant'", async () => {
    const client = makeClient([
      { ts: "1", text: "I am a bot", bot_id: "B123" },
    ]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.history[0]).toEqual({ role: "assistant", content: "I am a bot" });
  });

  it("maps user messages (no bot_id) to role: 'user'", async () => {
    const client = makeClient([
      { ts: "1", text: "I am a human", user: "U999" },
    ]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.history[0]).toEqual({ role: "user", content: "I am a human" });
  });

  it("reverses messages to chronological order (oldest-first)", async () => {
    const client = makeClient([
      { ts: "3", text: "newest", user: "U1" },
      { ts: "2", text: "middle", user: "U1" },
      { ts: "1", text: "oldest", user: "U1" },
    ]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.history[0].content).toBe("oldest");
    expect(result.history[1].content).toBe("middle");
    expect(result.history[2].content).toBe("newest");
  });

  it("SubagentContext contains channelId, userId, threadTs, currentMessage, agentName from params", async () => {
    const client = makeClient([]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.channelId).toBe("C123");
    expect(result.userId).toBe("U456");
    expect(result.threadTs).toBe("1234.5678");
    expect(result.currentMessage).toBe("hello world");
    expect(result.agentName).toBe("echo");
  });

  it("filters out messages without text field", async () => {
    const client = makeClient([
      { ts: "1", text: "has text", user: "U1" },
      { ts: "2", user: "U2" },
      { ts: "3", text: "", user: "U3" },
    ]);
    const result = await buildSubagentContext({ ...baseParams, client });
    expect(result.history).toHaveLength(1);
    expect(result.history[0].content).toBe("has text");
  });
});
