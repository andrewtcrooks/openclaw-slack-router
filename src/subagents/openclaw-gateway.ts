import type { SubagentDefinition } from "./types.js";
import type { SubagentContext } from "../types.js";
import { gatewayChatSend } from "../gateway/chat-client.js";
import type { GatewayChatOptions } from "../gateway/chat-client.js";
import { randomUUID } from "node:crypto";

function formatGatewayMessage(ctx: SubagentContext): string {
  const history = (ctx.threadHistory ?? [])
    .slice(-12)
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n");

  if (!history) return ctx.currentMessage;

  return [
    "Recent conversation context:",
    history,
    "",
    "Latest user message:",
    ctx.currentMessage,
  ].join("\n");
}

export interface OpenclawGatewaySubagentOptions {
  gatewayUrl: string;
  gatewayToken?: string;
  timeoutMs?: number;
}

export function createOpenclawGatewaySubagent(
  options: OpenclawGatewaySubagentOptions,
): SubagentDefinition {
  const { gatewayUrl, gatewayToken, timeoutMs } = options;

  return {
    name: "openclaw-gateway",
    description: "Routes messages through the local openclaw gateway",
    async handle(ctx: SubagentContext): Promise<string> {
      const chatOptions: GatewayChatOptions = {
        url: gatewayUrl,
        token: gatewayToken,
        timeoutMs,
      };

      const idempotencyKey = randomUUID();

      try {
        const result = await gatewayChatSend(chatOptions, {
          sessionKey: `slack:${ctx.channelId}`,
          message: formatGatewayMessage(ctx),
          idempotencyKey,
        });
        return result.text;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `[openclaw-gateway error] ${errorMsg}`;
      }
    },
  };
}
