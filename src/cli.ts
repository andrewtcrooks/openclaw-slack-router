#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import pkg from "../package.json" with { type: "json" };

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
  .command("reset-intro")
  .description("Clear the introPosted flag so the bot re-posts its welcome message on next start")
  .action(async () => {
    const { loadSubagentConfig, saveSubagentConfig, DEFAULT_CONFIG_PATH } = await import("./config.js");
    const config = loadSubagentConfig();
    config.introPosted = false;
    saveSubagentConfig(config, DEFAULT_CONFIG_PATH);
    console.log("✅ introPosted reset. Restart the gateway to re-post the welcome message.");
  });

program
  .command("start")
  .description("Start the Slack router (same as npm start)")
  .action(async () => {
    await import("./index.js");
  });

program.parse();
