import "dotenv/config";
import { loadConfig, loadSubagentConfig } from "./config.js";
import { createApp } from "./app.js";
import { buildSubagentRegistry } from "./subagents/index.js";

async function main() {
  const config = loadConfig();
  const subagentConfig = loadSubagentConfig();

  // Resolve bot's own user ID once at startup for assistant message tagging.
  // Uses WebClient directly (before creating the Bolt app) since createApp needs botUserId.
  const SlackBolt = await import("@slack/bolt");
  const slackBoltModule = SlackBolt as typeof import("@slack/bolt") & {
    default?: typeof import("@slack/bolt");
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slackBolt =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((slackBoltModule as any).App
      ? slackBoltModule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (slackBoltModule as any).default) ?? slackBoltModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { WebClient } = slackBolt as any;
  const client = new WebClient(config.SLACK_BOT_TOKEN);
  const authResult = await client.auth.test();
  const botUserId = authResult.user_id as string;

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  const subagentRegistry = buildSubagentRegistry({ gatewayUrl, gatewayToken });

  const app = createApp(config, subagentConfig, botUserId, subagentRegistry);
  await app.start();
  console.log(`Rook is running in Socket Mode (bot user: ${botUserId})`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
