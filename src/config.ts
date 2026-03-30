import { z } from "zod";
import { readFileSync } from "node:fs";
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

const channelConfigSchema = z.object({
  historyLimit: z.number().int().positive().optional(),
});

const subagentEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
});

const subagentConfigSchema = z.object({
  defaultAgent: z.string(),
  agents: z.record(subagentEntrySchema),
  channelConfig: z.record(channelConfigSchema).optional(),
});

export function loadSubagentConfig(
  path = "./subagent-config.json",
): SubagentConfig {
  const raw = readFileSync(path, "utf-8");
  return subagentConfigSchema.parse(JSON.parse(raw));
}
