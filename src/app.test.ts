import { describe, it, expect, vi, beforeEach } from "vitest";

// Track constructor calls and event registrations
const mockEventFn = vi.fn();
const mockConstructor = vi.fn();

vi.mock("@slack/bolt", () => {
  class MockApp {
    constructor(opts: Record<string, unknown>) {
      mockConstructor(opts);
    }
    event = mockEventFn;
  }
  return { default: { App: MockApp }, App: MockApp };
});

// Must import after mock
const { createApp } = await import("./app.js");

describe("createApp", () => {
  beforeEach(() => {
    mockConstructor.mockClear();
    mockEventFn.mockClear();
  });

  it("creates App with socketMode: true", () => {
    const config = {
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_APP_TOKEN: "xapp-test",
    };
    createApp(config);
    expect(mockConstructor).toHaveBeenCalledWith({
      token: "xoxb-test",
      appToken: "xapp-test",
      socketMode: true,
    });
  });

  it("registers app_mention event handler", () => {
    const config = {
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_APP_TOKEN: "xapp-test",
    };
    createApp(config);
    const eventCalls = mockEventFn.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(eventCalls).toContain("app_mention");
  });

  it("registers message event handler", () => {
    const config = {
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_APP_TOKEN: "xapp-test",
    };
    createApp(config);
    const eventCalls = mockEventFn.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(eventCalls).toContain("message");
  });
});
