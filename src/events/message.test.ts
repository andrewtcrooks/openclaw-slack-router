import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMessageHandler } from "./message.js";
import type { SubagentConfig } from "../types.js";

describe("registerMessageHandler", () => {
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

  const makeClient = () => ({
    conversations: {
      history: vi.fn().mockResolvedValue({ messages: [], has_more: false }),
    },
  });

  beforeEach(() => {
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp, config, botUserId);
    const messageCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "message",
    );
    handler = messageCall![1] as typeof handler;
  });

  it("routes DM to default agent and replies in thread with [agentName]", async () => {
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
    expect(callArg.text).toContain("[echo]");
  });

  it("routes DM via slash prefix to named agent", async () => {
    const localConfig: SubagentConfig = {
      defaultAgent: "echo",
      agents: {
        echo: { name: "echo", description: "Echo agent" },
        research: { name: "research", description: "Research agent" },
      },
    };
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp, localConfig, botUserId);
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
    expect(callArg.text).toContain("[research]");
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

  it("includes history count in stub reply", async () => {
    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      text: "hello",
    };
    const client = {
      conversations: {
        history: vi.fn().mockResolvedValue({
          messages: [{ text: "msg1", user: "U111" }],
          has_more: false,
        }),
      },
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("1 history msgs");
  });
});
