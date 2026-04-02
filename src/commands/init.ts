import { input, password, confirm, select } from "@inquirer/prompts";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { saveSubagentConfig, DEFAULT_CONFIG_PATH } from "../config.js";
import type { SubagentConfig } from "../types.js";

const OPENCLAW_ENV_PATH = path.join(homedir(), ".openclaw", ".env");

/** Parse a .env file into a key→value map (skips comments and blank lines). */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const lines = readFileSync(filePath, "utf-8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    result[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return result;
}

/** Append new KEY=VALUE pairs to ~/.openclaw/.env, skipping keys that already exist. */
function appendToOpenclawEnv(pairs: Record<string, string>): void {
  const existing = parseEnvFile(OPENCLAW_ENV_PATH);
  const newLines = Object.entries(pairs)
    .filter(([k]) => !existing[k])
    .map(([k, v]) => `${k}=${v}`);

  if (newLines.length === 0) return;

  const current = existsSync(OPENCLAW_ENV_PATH)
    ? readFileSync(OPENCLAW_ENV_PATH, "utf-8").trimEnd()
    : "";
  const separator = current ? "\n" : "";
  writeFileSync(
    OPENCLAW_ENV_PATH,
    current + separator + "\n" + newLines.join("\n") + "\n",
    "utf-8",
  );
}

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
  const existingEnv = parseEnvFile(OPENCLAW_ENV_PATH);
  const hasExistingTokens =
    existingEnv["SLACK_BOT_TOKEN"]?.startsWith("xoxb-") &&
    existingEnv["SLACK_APP_TOKEN"]?.startsWith("xapp-");

  let botToken: string;
  let appToken: string;

  if (hasExistingTokens) {
    console.log(`\nFound existing Slack tokens in ${OPENCLAW_ENV_PATH}`);
    const tokenSource = await select({
      message: "Use existing tokens or enter new ones?",
      choices: [
        { name: `Use existing (${existingEnv["SLACK_BOT_TOKEN"]!.slice(0, 14)}...)`, value: "existing" },
        { name: "Enter new tokens manually", value: "manual" },
      ],
    });

    if (tokenSource === "existing") {
      botToken = existingEnv["SLACK_BOT_TOKEN"]!;
      appToken = existingEnv["SLACK_APP_TOKEN"]!;
    } else {
      botToken = await password({
        message: "Bot token (xoxb-...):",
        validate: (v) => v.startsWith("xoxb-") || "Must start with xoxb-",
      });
      appToken = await password({
        message: "App token for Socket Mode (xapp-...):",
        validate: (v) => v.startsWith("xapp-") || "Must start with xapp-",
      });
    }
  } else {
    console.log(`\nSlack credentials (from https://api.slack.com/apps):`);
    botToken = await password({
      message: "Bot token (xoxb-...):",
      validate: (v) => v.startsWith("xoxb-") || "Must start with xoxb-",
    });
    appToken = await password({
      message: "App token for Socket Mode (xapp-...):",
      validate: (v) => v.startsWith("xapp-") || "Must start with xapp-",
    });
  }

  // --- Gateway ---
  console.log("\nopenclaw gateway connection:");

  const gatewayUrl = await input({
    message: "Gateway WebSocket URL:",
    default: existingEnv["OPENCLAW_GATEWAY_URL"] ?? "ws://127.0.0.1:18789",
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

  console.log(`\nCreate #${mainChannelName} in Slack and invite your bot to it if you haven't already.`);
  console.log("Then find the channel ID: right-click the channel → View channel details → copy the ID starting with C...");

  const mainChannelId = await input({
    message: "Channel ID (leave blank to set later):",
    validate: (v) => v === "" || /^C[A-Z0-9]+$/.test(v) || "Channel ID should start with C followed by uppercase letters/numbers",
  });

  // --- Write tokens to ~/.openclaw/.env ---
  const newEnvPairs: Record<string, string> = {
    SLACK_BOT_TOKEN: botToken,
    SLACK_APP_TOKEN: appToken,
    OPENCLAW_GATEWAY_URL: gatewayUrl,
    ...(gatewayTokenRaw ? { OPENCLAW_GATEWAY_TOKEN: gatewayTokenRaw } : {}),
  };

  appendToOpenclawEnv(newEnvPairs);
  console.log(`\n✅ Tokens saved to ${OPENCLAW_ENV_PATH}`);

  // --- Write config ---
  const config: SubagentConfig = {
    botName,
    mainChannelId: mainChannelId || null,
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

  const channelIdStep = mainChannelId
    ? ""
    : `  2. Copy the channel ID (right-click → View channel details → copy ID starting with C...)
  3. Add it to ${DEFAULT_CONFIG_PATH}:
       "mainChannelId": "CXXXXXXXXX"\n`;

  console.log(`
Next steps:
  1. Create a Slack channel named #${mainChannelName} and invite your bot to it
${channelIdStep}  ${mainChannelId ? "2" : "4"}. Restart openclaw: openclaw gateway restart

On first start, the bot will post setup instructions in #${mainChannelName}.
From there, say  new channel <name>  to create project channels.
`);
}
