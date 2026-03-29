import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAppMentionHandler } from "./app-mention.js";

describe("registerAppMentionHandler", () => {
  let mockApp: { event: ReturnType<typeof vi.fn> };
  let handler: (args: {
    event: Record<string, unknown>;
    client: Record<string, unknown>;
    say: ReturnType<typeof vi.fn>;
  }) => Promise<void>;

  beforeEach(() => {
    mockApp = { event: vi.fn() };
    registerAppMentionHandler(mockApp);
    const appMentionCall = mockApp.event.mock.calls.find(
      (call: unknown[]) => call[0] === "app_mention",
    );
    handler = appMentionCall![1] as typeof handler;
  });

  it("calls conversations.join with the channel", async () => {
    const event = { channel: "C123", user: "U456", ts: "1234.5678" };
    const client = {
      conversations: { join: vi.fn().mockResolvedValue({}) },
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(client.conversations.join).toHaveBeenCalledWith({
      channel: "C123",
    });
  });

  it("replies in thread with user mention", async () => {
    const event = { channel: "C123", user: "U456", ts: "1234.5678" };
    const client = {
      conversations: { join: vi.fn().mockResolvedValue({}) },
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "1234.5678" }),
    );
    const callArg = say.mock.calls[0][0] as { text: string };
    expect(callArg.text).toContain("<@U456>");
  });

  it("replies in existing thread using thread_ts", async () => {
    const event = {
      channel: "C123",
      user: "U456",
      ts: "1234.5678",
      thread_ts: "1111.2222",
    };
    const client = {
      conversations: { join: vi.fn().mockResolvedValue({}) },
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "1111.2222" }),
    );
  });

  it("continues if conversations.join throws", async () => {
    const event = { channel: "C123", user: "U456", ts: "1234.5678" };
    const client = {
      conversations: {
        join: vi
          .fn()
          .mockRejectedValue(
            new Error("method_not_supported_for_channel_type"),
          ),
      },
    };
    const say = vi.fn().mockResolvedValue({});

    await handler({ event, client, say });

    expect(say).toHaveBeenCalled();
  });
});
