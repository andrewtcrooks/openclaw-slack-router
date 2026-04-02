import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { SubagentConfig } from "./types.js";

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
