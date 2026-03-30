import type { SubagentDefinition } from "./types.js";
import type { SubagentContext } from "../types.js";
import { gatewayChatSend } from "../gateway/chat-client.js";
import type { GatewayChatOptions } from "../gateway/chat-client.js";
import { randomUUID } from "node:crypto";

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
          sessionKey: ctx.channelId,
          message: ctx.currentMessage,
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
