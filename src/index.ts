import { config as dotenvConfig } from "dotenv";
import { join } from "node:path";
import { homedir } from "node:os";

// Load ~/.openclaw/.env first (openclaw's canonical env store), then fall back to local .env
dotenvConfig({ path: join(homedir(), ".openclaw", ".env") });
dotenvConfig(); // local .env — skips keys already set

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
