import { describe, it, expect, vi } from "vitest";
import { createOpenclawGatewaySubagent } from "./openclaw-gateway.js";
import type { SubagentContext } from "../types.js";

vi.mock("../gateway/chat-client.js", () => ({
  gatewayChatSend: vi.fn(),
}));

import { gatewayChatSend } from "../gateway/chat-client.js";
const mockGatewayChatSend = vi.mocked(gatewayChatSend);

const baseCtx: SubagentContext = {
  channelId: "C08ABC123",
  userId: "U456",
  threadTs: "1234.5678",
  currentMessage: "hello world",
  threadHistory: [],
  agentName: "default",
};

describe("createOpenclawGatewaySubagent", () => {
  it("conforms to SubagentDefinition interface", () => {
    const subagent = createOpenclawGatewaySubagent({
      gatewayUrl: "ws://localhost:18789",
    });
    expect(subagent.name).toBe("openclaw-gateway");
    expect(subagent.description).toBeTruthy();
    expect(typeof subagent.handle).toBe("function");
  });

  it("handle() calls gatewayChatSend with namespaced session key and formatted message", async () => {
    mockGatewayChatSend.mockResolvedValue({
      text: "response",
      runId: "r1",
    });

    const subagent = createOpenclawGatewaySubagent({
      gatewayUrl: "ws://localhost:18789",
      gatewayToken: "tok",
    });
    await subagent.handle(baseCtx);

    expect(mockGatewayChatSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: "ws://localhost:18789", token: "tok" }),
      expect.objectContaining({
        sessionKey: "slack:C08ABC123",
        message: "hello world",
      }),
    );
  });

  it("handle() returns the text from gatewayChatSend result", async () => {
    mockGatewayChatSend.mockResolvedValue({
      text: "LLM says hello",
      runId: "r1",
    });

    const subagent = createOpenclawGatewaySubagent({
      gatewayUrl: "ws://localhost:18789",
    });
    const result = await subagent.handle(baseCtx);

    expect(result).toBe("LLM says hello");
  });

  it("handle() returns error string when gatewayChatSend rejects", async () => {
    mockGatewayChatSend.mockRejectedValue(new Error("ECONNREFUSED"));

    const subagent = createOpenclawGatewaySubagent({
      gatewayUrl: "ws://localhost:18789",
    });
    const result = await subagent.handle(baseCtx);

    expect(result).toContain("[openclaw-gateway error]");
    expect(result).toContain("ECONNREFUSED");
  });
});
