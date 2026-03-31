import { describe, it, expect } from "vitest";
import { resolveRoute, UnknownAgentError } from "./router.js";
import type { SubagentConfig } from "./types.js";

const config: SubagentConfig = {
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

const BOT_ID = "UBOT123";

describe("resolveRoute", () => {
  it("strips bot mention and resolves slash prefix: '<@UBOT123> /research do this'", () => {
    const result = resolveRoute("<@UBOT123> /research do this", BOT_ID, config);
    expect(result).toEqual({ agentName: "research", text: "do this" });
  });

  it("resolves colon prefix: 'research: do this'", () => {
    const result = resolveRoute("research: do this", BOT_ID, config);
    expect(result).toEqual({ agentName: "research", text: "do this" });
  });

  it("falls back to defaultAgent when no prefix: 'plain message'", () => {
    const result = resolveRoute("plain message", BOT_ID, config);
    expect(result).toEqual({ agentName: "echo", text: "plain message" });
  });

  it("DM message without mention resolves slash prefix: '/research do this'", () => {
    const result = resolveRoute("/research do this", BOT_ID, config);
    expect(result).toEqual({ agentName: "research", text: "do this" });
  });

  it("DM message without mention uses default: 'plain message'", () => {
    const result = resolveRoute("plain message", BOT_ID, config);
    expect(result).toEqual({ agentName: "echo", text: "plain message" });
  });

  it("throws UnknownAgentError for unknown agent: '/unknown hello'", () => {
    expect(() => resolveRoute("/unknown hello", BOT_ID, config)).toThrow(
      UnknownAgentError,
    );
    expect(() => resolveRoute("/unknown hello", BOT_ID, config)).toThrow(
      /unknown/,
    );
    expect(() => resolveRoute("/unknown hello", BOT_ID, config)).toThrow(
      /echo.*research|research.*echo/,
    );
  });

  it("UnknownAgentError includes requestedAgent and availableAgents fields", () => {
    let caught: unknown;
    try {
      resolveRoute("/badagent hello", BOT_ID, config);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnknownAgentError);
    const error = caught as UnknownAgentError;
    expect(error.requestedAgent).toBe("badagent");
    expect(error.availableAgents).toContain("echo");
    expect(error.availableAgents).toContain("research");
  });

  it("strips mention only (no agent prefix): '<@UBOT123> plain message'", () => {
    const result = resolveRoute("<@UBOT123> plain message", BOT_ID, config);
    expect(result).toEqual({ agentName: "echo", text: "plain message" });
  });
});
