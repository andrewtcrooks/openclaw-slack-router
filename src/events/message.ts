import { resolveThreadTs } from "../handlers/reply.js";

// Using `any` for app parameter to avoid ESM/CJS type import issues with @slack/bolt.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerMessageHandler(app: any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.event("message", async ({ event, say }: any) => {
    // SLACK-02: Only handle DMs
    if (event.channel_type !== "im") return;
    // Skip message subtypes (edits, deletes, etc.)
    if (event.subtype) return;
    // Skip bot messages to avoid infinite loops
    if (event.bot_id) return;

    // SLACK-03: Reply in thread
    const threadTs = resolveThreadTs(event);
    await say({
      text: "Hello! (stub reply)",
      thread_ts: threadTs,
    });
  });
}
