import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { SubagentConfig } from "./types.js";

export const OPENCLAW_ENV_PATH = path.join(homedir(), ".openclaw", ".env");

/** Parse a .env file into a key→value map (skips comments and blank lines). */
export function parseEnvFile(filePath: string): Record<string, string> {
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
export function appendToOpenclawEnv(pairs: Record<string, string>): void {
  const existing = parseEnvFile(OPENCLAW_ENV_PATH);
  const newLines = Object.entries(pairs)
    .filter(([k]) => !existing[k])
    .map(([k, v]) => `${k}=${v}`);

  if (newLines.length === 0) return;

  mkdirSync(path.dirname(OPENCLAW_ENV_PATH), { recursive: true });
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

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-", "Must be a bot token (xoxb-)"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-", "Must be an app token (xapp-)"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${messages}`);
  }
  return result.data;
}

const channelEntrySchema = z.object({
  name: z.string(),
  historyLimit: z.number().int().positive().optional(),
});

const subagentEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
});

const subagentConfigSchema = z.object({
  botName: z.string().default("Rook"),
  mainChannelId: z.string().nullable().default(null),
  introPosted: z.boolean().default(false),
  defaultAgent: z.string(),
  agents: z.record(subagentEntrySchema),
  channels: z.record(channelEntrySchema).default({}),
});

export const DEFAULT_CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw-slack-router.config.json");

const DEFAULT_SUBAGENT_CONFIG = {
  defaultAgent: "default",
  agents: { default: { name: "openclaw-gateway", description: "Routes messages through the local openclaw gateway" } },
};

export function loadSubagentConfig(
  configPath = DEFAULT_CONFIG_PATH,
): SubagentConfig {
  if (!existsSync(configPath)) {
    return subagentConfigSchema.parse(DEFAULT_SUBAGENT_CONFIG);
  }
  const raw = readFileSync(configPath, "utf-8");
  return subagentConfigSchema.parse(JSON.parse(raw));
}

export function saveSubagentConfig(
  config: SubagentConfig,
  path = DEFAULT_CONFIG_PATH,
): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
