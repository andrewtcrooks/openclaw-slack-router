import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMessageHandler } from "./message.js";
import type { SubagentConfig } from "../types.js";
import type { SubagentRegistry } from "../subagents/index.js";

describe("registerMessageHandler", () => {
  let mockApp: { event: ReturnType<typeof vi.fn> };
  let handler: (args: {
    event: Record<string, unknown>;
    client: Record<string, unknown>;
    say: ReturnType<typeof vi.fn>;
  }) => Promise<void>;

  const config: SubagentConfig = {
    botName: "TestBot",
    mainChannelId: null,
    introPosted: false,
    defaultAgent: "echo",
    agents: { echo: { name: "echo", description: "Echo agent" } },
    channels: {},
  };
  const botUserId = "UBOT1";

  const mockRegistry: SubagentRegistry = {
    echo: {
      name: "echo",
      description: "Echo agent",
      handle: async (ctx) => `Echo: ${ctx.currentMessage}`,
    },
  };

  const makeClient = () => ({
    conversations: {
      history: vi.fn().mockResolvedValue({ messages: [], has_more: false }),
    },
  });

  beforeEach(() => {
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp, config, botUserId, mockRegistry);
    const messageCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "message",
    );
    handler = messageCall![1] as typeof handler;
  });

  it("routes DM to default agent and replies in thread via subagent.handle()", async () => {
    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      text: "hello there",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "1234.5678" }),
    );
    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("Echo:");
  });

  it("routes DM via slash prefix to named agent", async () => {
    const localConfig: SubagentConfig = {
      botName: "TestBot",
      mainChannelId: null,
      introPosted: false,
      defaultAgent: "echo",
      agents: {
        echo: { name: "echo", description: "Echo agent" },
        research: { name: "research", description: "Research agent" },
      },
      channels: {},
    };
    const localRegistry: SubagentRegistry = {
      ...mockRegistry,
      research: {
        name: "research",
        description: "Research agent",
        handle: async (ctx) => `Research: ${ctx.currentMessage}`,
      },
    };
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp, localConfig, botUserId, localRegistry);
    const messageCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "message",
    );
    const localHandler = messageCall![1] as typeof handler;

    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      text: "/research do this",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await localHandler({ event, client, say });

    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("Research:");
  });

  it("ignores non-DM messages", async () => {
    const event = {
      channel_type: "channel",
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "hello",
    };
    const client = makeClient();
    const say = vi.fn();

    await handler({ event, client, say });

    expect(say).not.toHaveBeenCalled();
  });

  it("ignores message subtypes (edits, deletes)", async () => {
    const event = {
      channel_type: "im",
      subtype: "message_changed",
      channel: "D123",
      ts: "1234.5678",
      text: "hello",
    };
    const client = makeClient();
    const say = vi.fn();

    await handler({ event, client, say });

    expect(say).not.toHaveBeenCalled();
  });

  it("ignores bot messages", async () => {
    const event = {
      channel_type: "im",
      bot_id: "B123",
      channel: "D123",
      ts: "1234.5678",
      text: "hello",
    };
    const client = makeClient();
    const say = vi.fn();

    await handler({ event, client, say });

    expect(say).not.toHaveBeenCalled();
  });

  it("replies in existing DM thread", async () => {
    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      thread_ts: "9999.0000",
      text: "hello",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "9999.0000" }),
    );
  });

  it("replies with Unknown agent error message for unknown agent in DM", async () => {
    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      text: "/nonexistent do something",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "1234.5678" }),
    );
    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("Unknown agent");
  });

  it("calls subagent.handle with SubagentContext containing threadHistory", async () => {
    const handleSpy = vi.fn().mockResolvedValue("response");
    const spyRegistry: SubagentRegistry = {
      echo: {
        name: "echo",
        description: "Echo agent",
        handle: handleSpy,
      },
    };
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp, config, botUserId, spyRegistry);
    const messageCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "message",
    );
    const localHandler = messageCall![1] as typeof handler;

    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      text: "hello",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await localHandler({ event, client, say });

    expect(handleSpy).toHaveBeenCalledOnce();
    const ctx = handleSpy.mock.calls[0][0];
    expect(ctx).toHaveProperty("threadHistory");
    expect(ctx).not.toHaveProperty("history");
  });

  it("replies with 'No subagent implementation registered' when agent in config but not in registry", async () => {
    const localConfig: SubagentConfig = {
      botName: "TestBot",
      mainChannelId: null,
      introPosted: false,
      defaultAgent: "ghost",
      agents: {
        ghost: { name: "ghost", description: "Ghost agent" },
      },
      channels: {},
    };
    const emptyRegistry: SubagentRegistry = {};
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp, localConfig, botUserId, emptyRegistry);
    const messageCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "message",
    );
    const localHandler = messageCall![1] as typeof handler;

    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      text: "hello",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await localHandler({ event, client, say });

    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("No subagent implementation registered");
  });
});
