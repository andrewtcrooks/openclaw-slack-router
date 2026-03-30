import SlackBolt from "@slack/bolt";
import type { AppConfig } from "./config.js";
import type { SubagentConfig } from "./types.js";
import type { SubagentRegistry } from "./subagents/index.js";
import { registerAppMentionHandler } from "./events/app-mention.js";
import { registerMessageHandler } from "./events/message.js";

const slackBoltModule = SlackBolt as typeof import("@slack/bolt") & {
  default?: typeof import("@slack/bolt");
};
const slackBolt =
  (slackBoltModule.App ? slackBoltModule : slackBoltModule.default) ??
  slackBoltModule;
const { App } = slackBolt;

export function createApp(
  config: AppConfig,
  subagentConfig: SubagentConfig,
  botUserId: string,
  subagentRegistry: SubagentRegistry,
): InstanceType<typeof App> {
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
  });

  registerAppMentionHandler(app, subagentConfig, botUserId, subagentRegistry);
  registerMessageHandler(app, subagentConfig, botUserId, subagentRegistry);

  return app;
}
