import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, loadSubagentConfig } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
    process.env.SLACK_APP_TOKEN = "xapp-test-token";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns typed config when valid env vars set", () => {
    const config = loadConfig();
    expect(config.SLACK_BOT_TOKEN).toBe("xoxb-test-token");
    expect(config.SLACK_APP_TOKEN).toBe("xapp-test-token");
  });

  it("throws when SLACK_BOT_TOKEN is missing", () => {
    delete process.env.SLACK_BOT_TOKEN;
    expect(() => loadConfig()).toThrow("SLACK_BOT_TOKEN");
  });

  it("throws when SLACK_APP_TOKEN is missing", () => {
    delete process.env.SLACK_APP_TOKEN;
    expect(() => loadConfig()).toThrow("SLACK_APP_TOKEN");
  });

  it("throws when SLACK_BOT_TOKEN has wrong prefix", () => {
    process.env.SLACK_BOT_TOKEN = "bad-token";
    expect(() => loadConfig()).toThrow("xoxb-");
  });

  it("throws when SLACK_APP_TOKEN has wrong prefix", () => {
    process.env.SLACK_APP_TOKEN = "bad-token";
    expect(() => loadConfig()).toThrow("xapp-");
  });

  it("throws with both field names when both tokens missing", () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    expect(() => loadConfig()).toThrow(/SLACK_BOT_TOKEN/);
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    expect(() => loadConfig()).toThrow(/SLACK_APP_TOKEN/);
  });
});

describe("loadSubagentConfig", () => {
  it("loads subagent config from file", () => {
    const config = loadSubagentConfig();
    expect(config.defaultAgent).toBe("echo");
    expect(config.agents.echo).toBeDefined();
    expect(config.agents.echo.name).toBe("echo");
  });
});
