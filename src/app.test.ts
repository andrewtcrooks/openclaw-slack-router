import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SubagentConfig } from "./types.js";
import type { SubagentRegistry } from "./subagents/index.js";

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

  const config = {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_APP_TOKEN: "xapp-test",
  };
  const subagentConfig: SubagentConfig = {
    defaultAgent: "echo",
    agents: { echo: { name: "echo", description: "Echo agent" } },
  };
  const botUserId = "UBOT1";
  const registry: SubagentRegistry = {};

  it("creates App with socketMode: true", () => {
    createApp(config, subagentConfig, botUserId, registry);
    expect(mockConstructor).toHaveBeenCalledWith({
      token: "xoxb-test",
      appToken: "xapp-test",
      socketMode: true,
    });
  });

  it("registers app_mention event handler", () => {
    createApp(config, subagentConfig, botUserId, registry);
    const eventCalls = mockEventFn.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(eventCalls).toContain("app_mention");
  });

  it("registers message event handler", () => {
    createApp(config, subagentConfig, botUserId, registry);
    const eventCalls = mockEventFn.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(eventCalls).toContain("message");
  });
});
