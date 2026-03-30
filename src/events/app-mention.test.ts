import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAppMentionHandler } from "./app-mention.js";
import type { SubagentConfig } from "../types.js";
import type { SubagentRegistry } from "../subagents/index.js";

describe("registerAppMentionHandler", () => {
  let mockApp: { event: ReturnType<typeof vi.fn> };
  let handler: (args: {
    event: Record<string, unknown>;
    client: Record<string, unknown>;
    say: ReturnType<typeof vi.fn>;
  }) => Promise<void>;

  const config: SubagentConfig = {
    defaultAgent: "echo",
    agents: { echo: { name: "echo", description: "Echo agent" } },
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
      join: vi.fn().mockResolvedValue({}),
      history: vi.fn().mockResolvedValue({ messages: [], has_more: false }),
    },
  });

  beforeEach(() => {
    mockApp = { event: vi.fn() };
    registerAppMentionHandler(mockApp, config, botUserId, mockRegistry);
    const appMentionCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "app_mention",
    );
    handler = appMentionCall![1] as typeof handler;
  });

  it("calls conversations.join with the channel", async () => {
    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> hello",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(client.conversations.join).toHaveBeenCalledWith({
      channel: "C123",
    });
  });

  it("routes to default agent and replies in thread via subagent.handle()", async () => {
    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> hello there",
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

  it("routes to named agent via slash prefix", async () => {
    const localConfig: SubagentConfig = {
      defaultAgent: "echo",
      agents: {
        echo: { name: "echo", description: "Echo agent" },
        research: { name: "research", description: "Research agent" },
      },
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
    registerAppMentionHandler(mockApp, localConfig, botUserId, localRegistry);
    const appMentionCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "app_mention",
    );
    const localHandler = appMentionCall![1] as typeof handler;

    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> /research do this task",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await localHandler({ event, client, say });

    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("Research:");
  });

  it("replies in existing thread using thread_ts", async () => {
    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      thread_ts: "1111.2222",
      text: "<@UBOT1> hello",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "1111.2222" }),
    );
  });

  it("continues if conversations.join throws", async () => {
    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> hello",
    };
    const client = {
      conversations: {
        join: vi
          .fn()
          .mockRejectedValue(
            new Error("method_not_supported_for_channel_type"),
          ),
        history: vi.fn().mockResolvedValue({ messages: [], has_more: false }),
      },
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalled();
  });

  it("replies with Unknown agent error message for unknown agent", async () => {
    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> /nonexistent do something",
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
    registerAppMentionHandler(mockApp, config, botUserId, spyRegistry);
    const appMentionCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "app_mention",
    );
    const localHandler = appMentionCall![1] as typeof handler;

    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> hello",
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
      defaultAgent: "ghost",
      agents: {
        ghost: { name: "ghost", description: "Ghost agent" },
      },
    };
    const emptyRegistry: SubagentRegistry = {};
    mockApp = { event: vi.fn() };
    registerAppMentionHandler(mockApp, localConfig, botUserId, emptyRegistry);
    const appMentionCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "app_mention",
    );
    const localHandler = appMentionCall![1] as typeof handler;

    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      text: "<@UBOT1> hello",
    };
    const client = makeClient();
    const say = vi.fn().mockResolvedValue({});

    await localHandler({ event, client, say });

    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("No subagent implementation registered");
  });
});
