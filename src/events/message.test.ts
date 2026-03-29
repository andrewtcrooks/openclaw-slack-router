import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMessageHandler } from "./message.js";

describe("registerMessageHandler", () => {
  let mockApp: { event: ReturnType<typeof vi.fn> };
  let handler: (args: {
    event: Record<string, unknown>;
    say: ReturnType<typeof vi.fn>;
  }) => Promise<void>;

  beforeEach(() => {
    mockApp = { event: vi.fn() };
    registerMessageHandler(mockApp);
    const messageCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "message",
    );
    handler = messageCall![1] as typeof handler;
  });

  it("replies to DM messages in thread", async () => {
    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "1234.5678" }),
    );
    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("Hello");
  });

  it("ignores non-DM messages", async () => {
    const event = {
      channel_type: "channel",
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
    };
    const say = vi.fn();

    await handler({ event, say });

    expect(say).not.toHaveBeenCalled();
  });

  it("ignores message subtypes (edits, deletes)", async () => {
    const event = {
      channel_type: "im",
      subtype: "message_changed",
      channel: "D123",
      ts: "1234.5678",
    };
    const say = vi.fn();

    await handler({ event, say });

    expect(say).not.toHaveBeenCalled();
  });

  it("ignores bot messages", async () => {
    const event = {
      channel_type: "im",
      bot_id: "B123",
      channel: "D123",
      ts: "1234.5678",
    };
    const say = vi.fn();

    await handler({ event, say });

    expect(say).not.toHaveBeenCalled();
  });

  it("replies in existing DM thread", async () => {
    const event = {
      channel_type: "im",
      channel: "D123",
      user: "U456",
      ts: "1234.5678",
      thread_ts: "9999.0000",
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "9999.0000" }),
    );
  });
});
