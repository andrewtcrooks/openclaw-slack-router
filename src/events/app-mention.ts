import { resolveThreadTs } from "../handlers/reply.js";
import { resolveRoute, UnknownAgentError } from "../router.js";
import { buildSubagentContext } from "../context.js";
import type { SubagentConfig } from "../types.js";

// Using `any` for app parameter to avoid ESM/CJS type import issues with @slack/bolt.
// The runtime behavior is verified by tests; TypeScript types for Bolt's App class
// are not reliably importable as a type-only import in all ESM/CJS interop scenarios.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerAppMentionHandler(
  app: any,
  config: SubagentConfig,
  botUserId: string,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.event("app_mention", async ({ event, client, say }: any) => {
    // SLACK-06: Join channel on mention (idempotent, fails gracefully for private channels)
    try {
      await client.conversations.join({ channel: event.channel });
    } catch {
      // Private channel or already joined — continue
    }

    // SLACK-03: Reply in thread
    const threadTs = resolveThreadTs(event);

    try {
      const route = resolveRoute(event.text, botUserId, config);
      const context = await buildSubagentContext({
        client,
        channelId: event.channel,
        currentMessage: route.text,
        userId: event.user,
        threadTs,
        agentName: route.agentName,
        config,
        botUserId,
      });

      // Phase 2 stub dispatch — Phase 3 replaces with real subagent execution
      await say({
        text: `[${context.agentName}] ${context.currentMessage} (${context.history.length} history msgs)`,
        thread_ts: threadTs,
      });
    } catch (err) {
      const message =
        err instanceof UnknownAgentError
          ? err.message
          : "An error occurred processing your request.";
      await say({ text: message, thread_ts: threadTs });
    }
  });
}
