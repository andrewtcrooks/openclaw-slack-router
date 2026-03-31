import { input, password, confirm } from "@inquirer/prompts";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { saveSubagentConfig, DEFAULT_CONFIG_PATH } from "../config.js";
import type { SubagentConfig } from "../types.js";

const ENV_PATH = ".env";

export async function runInit(): Promise<void> {
  console.log("\nopenclaw-slack-router setup\n");

  if (existsSync(DEFAULT_CONFIG_PATH)) {
    const overwrite = await confirm({
      message: `${DEFAULT_CONFIG_PATH} already exists. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // --- Slack credentials ---
  console.log("\nSlack credentials (from https://api.slack.com/apps):");

  const botToken = await password({
    message: "Bot token (xoxb-...):",
    validate: (v) => v.startsWith("xoxb-") || "Must start with xoxb-",
  });

  const appToken = await password({
    message: "App token for Socket Mode (xapp-...):",
    validate: (v) => v.startsWith("xapp-") || "Must start with xapp-",
  });

  // --- Gateway ---
  console.log("\nopenclaw gateway connection:");

  const gatewayUrl = await input({
    message: "Gateway WebSocket URL:",
    default: "ws://127.0.0.1:18789",
  });

  const gatewayTokenRaw = await password({
    message: "Gateway token (leave blank if none):",
  });

  // --- Bot identity ---
  console.log("\nBot identity:");

  const botName = await input({
    message: "Bot name (shown in startup logs and error messages):",
    default: "Rook",
  });

  // --- Main channel ---
  console.log("\nMain channel setup:");
  console.log("The main channel is your control panel — you create project channels by chatting here.");

  const mainChannelName = await input({
    message: "Main channel name (will be created in Slack):",
    default: "rook-main",
    validate: (v) => /^[a-z0-9-]{1,80}$/.test(v) || "Use lowercase letters, numbers, and hyphens only",
  });

  // --- Write .env ---
  const envLines = [
    `SLACK_BOT_TOKEN=${botToken}`,
    `SLACK_APP_TOKEN=${appToken}`,
    `OPENCLAW_GATEWAY_URL=${gatewayUrl}`,
    ...(gatewayTokenRaw ? [`OPENCLAW_GATEWAY_TOKEN=${gatewayTokenRaw}`] : []),
  ];

  // Merge with existing .env if present
  if (existsSync(ENV_PATH)) {
    const existing = readFileSync(ENV_PATH, "utf-8");
    const existingKeys = new Set(
      existing.split("\n").map((l) => l.split("=")[0]).filter(Boolean),
    );
    const newLines = envLines.filter((l) => {
      const key = l.split("=")[0];
      return !existingKeys.has(key);
    });
    if (newLines.length > 0) {
      writeFileSync(ENV_PATH, existing.trimEnd() + "\n" + newLines.join("\n") + "\n", "utf-8");
    }
  } else {
    writeFileSync(ENV_PATH, envLines.join("\n") + "\n", "utf-8");
  }

  console.log(`\n✅ Written ${ENV_PATH}`);

  // --- Write config ---
  const config: SubagentConfig = {
    botName,
    mainChannelId: null, // filled in after bot creates/joins the channel on first start
    introPosted: false,
    defaultAgent: "default",
    agents: {
      default: {
        name: "openclaw-gateway",
        description: "Routes messages through the local openclaw gateway",
      },
    },
    channels: {},
  };

  saveSubagentConfig(config);
  console.log(`✅ Written ${DEFAULT_CONFIG_PATH}`);

  console.log(`
Next steps:
  1. Create a Slack channel named #${mainChannelName} and invite your bot to it
  2. Copy the channel ID (right-click → View channel details → copy ID starting with C...)
  3. Add it to ${DEFAULT_CONFIG_PATH}:
       "mainChannelId": "CXXXXXXXXX"
  4. Run: openclaw-slack-router start

On first start, the bot will post setup instructions in #${mainChannelName}.
From there, say  new channel <name>  to create project channels.
`);
}
