import "dotenv/config";
import { loadConfig } from "./config.js";
import { startSlackBot } from "./bot.js";

async function main() {
  const config = loadConfig();

  await startSlackBot({
    botToken: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789",
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
