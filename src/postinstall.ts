#!/usr/bin/env node
/**
 * Runs automatically after `npm install` when this package is installed as a dependency.
 * Skips when running `npm install` in the package's own dev directory.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { runInit } from "./commands/init.js";

// Skip when this is a local dev `npm install` (not being installed as a plugin)
const initCwd = process.env.INIT_CWD ?? "";
const pkgDir = path.resolve(import.meta.dirname, "..");
if (initCwd === pkgDir || initCwd === "") {
  process.exit(0);
}

const envPath = path.join(homedir(), ".openclaw", ".env");

function hasTokens(): boolean {
  if (!existsSync(envPath)) return false;
  const contents = readFileSync(envPath, "utf-8");
  return contents.includes("SLACK_BOT_TOKEN=xoxb-") && contents.includes("SLACK_APP_TOKEN=xapp-");
}

if (hasTokens()) {
  console.log("\nopenclaw-slack-router: Slack tokens already configured. Skipping setup.\n");
  process.exit(0);
}

console.log("\nopenclaw-slack-router: Running first-time setup wizard...\n");
runInit().catch((err) => {
  console.error("Setup failed:", err.message);
  console.error("Run `openclaw slack setup` manually to configure the plugin.");
  process.exit(0); // Non-fatal — don't break the install
});
