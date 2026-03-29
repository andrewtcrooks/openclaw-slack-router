import { resolveThreadTs } from "../handlers/reply.js";

// Using `any` for app parameter to avoid ESM/CJS type import issues with @slack/bolt.
// The runtime behavior is verified by tests; TypeScript types for Bolt's App class
// are not reliably importable as a type-only import in all ESM/CJS interop scenarios.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerAppMentionHandler(app: any): void {
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
    await say({
      text: `Hello <@${event.user}>! (stub reply)`,
      thread_ts: threadTs,
    });
  });
}
