#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { runInit } from "./commands/init.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("openclaw-slack-router")
  .description("Slack router plugin for openclaw")
  .version(pkg.version);

program
  .command("init")
  .description("Interactive setup wizard — configure credentials and main channel")
  .action(runInit);

program
  .command("start")
  .description("Start the Slack router (same as npm start)")
  .action(async () => {
    await import("./index.js");
  });

program.parse();
