#!/usr/bin/env node
/**
 * Syncs README.md sections from source files before publish.
 * Sections are delimited by HTML comment markers:
 *   <!-- AUTO:name --> ... <!-- /AUTO:name -->
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf-8");
}

function replaceSection(readme, key, content) {
  const open = `<!-- AUTO:${key} -->`;
  const close = `<!-- /AUTO:${key} -->`;
  const re = new RegExp(`${open}[\\s\\S]*?${close}`, "g");
  if (!re.test(readme)) {
    console.warn(`Warning: marker AUTO:${key} not found in README`);
    return readme;
  }
  return readme.replace(re, `${open}\n${content}\n${close}`);
}

// bot-commands: derived from INTRO_MESSAGE bullet lines in admin.ts
function buildBotCommandsTable() {
  const src = read("src/admin.ts");
  const introMatch = src.match(/export const INTRO_MESSAGE = `([\s\S]+?)`;/);
  if (!introMatch) throw new Error("INTRO_MESSAGE not found in admin.ts");

  // Backticks are escaped as \` in the template literal source
  const bullets = [...introMatch[1].matchAll(/•\s+\\`([^`]+)\\`\s+—\s+(.+)/g)];
  if (bullets.length === 0) throw new Error("No bullet commands in INTRO_MESSAGE");

  const rows = bullets.map(([, cmd, desc]) => {
    const display = cmd.includes("<name>") ? cmd.replace("<name>", "my-project") : cmd;
    // Unescape backticks that were escaped for the template literal
    const cleanDesc = desc.trim().replace(/\\`/g, "`").replace(/^./, (c) => c.toUpperCase());
    return `| \`${display}\` | ${cleanDesc} |`;
  });

  if (!rows.some((r) => r.includes("`help`"))) {
    rows.push("| `help` | Shows available commands |");
  }

  return ["| Say this | What happens |", "|----------|-------------|", ...rows].join("\n");
}

// env-vars: derived from configSchema properties in plugin.ts
function buildEnvVarsTable() {
  const src = read("src/plugin.ts");
  const propsMatch = src.match(/properties:\s*\{([\s\S]+?)\},\s*required:/);
  if (!propsMatch) throw new Error("configSchema properties not found in plugin.ts");

  const envKeyMap = {
    botToken: ["SLACK_BOT_TOKEN", "Yes"],
    appToken: ["SLACK_APP_TOKEN", "Yes"],
    gatewayUrl: ["OPENCLAW_GATEWAY_URL", "No"],
    gatewayToken: ["OPENCLAW_GATEWAY_TOKEN", "No"],
  };

  const rows = [];
  const propRe = /(\w+):\s*\{[\s\S]*?description:\s*"([^"]+)"[\s\S]*?\}/g;
  let m;
  while ((m = propRe.exec(propsMatch[1])) !== null) {
    const [, key, desc] = m;
    const mapping = envKeyMap[key];
    if (!mapping) continue;
    rows.push(`| \`${mapping[0]}\` | ${mapping[1]} | ${desc} |`);
  }

  return ["| Variable | Required | Description |", "|----------|----------|-------------|", ...rows].join("\n");
}

// config-fields: derived from subagentConfigSchema field names in config.ts
function buildConfigFieldsTable() {
  const src = read("src/config.ts");
  const schemaMatch = src.match(/const subagentConfigSchema = z\.object\(\{([\s\S]+?)\}\)/);
  if (!schemaMatch) throw new Error("subagentConfigSchema not found in config.ts");

  const fieldDescriptions = {
    botName: "Display name used in logs and error messages",
    mainChannelId: "Channel ID of your admin/control channel",
    introPosted: "Set to `true` after the bot posts its first intro — prevents re-posting on restart",
    defaultAgent: "Which agent handles unrouted messages",
    agents: "Registered agent names and descriptions",
    channels: "Active project channels; `historyLimit` controls how many messages are fetched for context",
  };

  const rows = [];
  const fieldRe = /^\s+(\w+):/gm;
  let f;
  while ((f = fieldRe.exec(schemaMatch[1])) !== null) {
    const desc = fieldDescriptions[f[1]];
    if (desc) rows.push(`| \`${f[1]}\` | ${desc} |`);
  }

  return ["| Field | Description |", "|-------|-------------|", ...rows].join("\n");
}

let readme = read("README.md");

for (const [key, fn] of [
  ["bot-commands", buildBotCommandsTable],
  ["env-vars", buildEnvVarsTable],
  ["config-fields", buildConfigFieldsTable],
]) {
  try {
    readme = replaceSection(readme, key, fn());
    console.log(`✓ ${key}`);
  } catch (e) {
    console.warn(`⚠ ${key}: ${e.message}`);
  }
}

writeFileSync(path.join(root, "README.md"), readme, "utf-8");
console.log("README.md synced");
