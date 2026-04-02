import { loadSubagentConfig, DEFAULT_CONFIG_PATH } from "./config.js";
import { createApp } from "./app.js";
import { buildSubagentRegistry } from "./subagents/index.js";
import { postIntroIfNeeded } from "./admin.js";
import type { SubagentConfig } from "./types.js";

export interface SlackBotOptions {
  botToken?: string;
  appToken?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  /** Path to openclaw-slack-router.config.json. Defaults to ./openclaw-slack-router.config.json */
  configPath?: string;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runningApp: any = null;

export async function startSlackBot(options: SlackBotOptions): Promise<void> {
  const log = options.logger ?? console;

  const botToken = options.botToken ?? process.env.SLACK_BOT_TOKEN;
  const appToken = options.appToken ?? process.env.SLACK_APP_TOKEN;
  const gatewayUrl = options.gatewayUrl ?? process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
  const gatewayToken = options.gatewayToken ?? process.env.OPENCLAW_GATEWAY_TOKEN;
  const { configPath } = options;

  if (!botToken || !appToken) {
    log.error("openclaw-slack-router: not configured. Run `openclaw slack setup` before restarting the gateway.");
    return;
  }

  const subagentConfig: SubagentConfig = loadSubagentConfig(configPath ?? DEFAULT_CONFIG_PATH);

  // Resolve bot's own user ID at startup for assistant message tagging.
  // Uses WebClient directly (before creating the Bolt app) since createApp needs botUserId.
  const SlackBolt = await import("@slack/bolt");
  const slackBoltModule = SlackBolt as typeof import("@slack/bolt") & {
    default?: typeof import("@slack/bolt");
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slackBolt =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((slackBoltModule as any).App
      ? slackBoltModule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (slackBoltModule as any).default) ?? slackBoltModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { WebClient } = slackBolt as any;
  const client = new WebClient(botToken);
  const authResult = await client.auth.test();
  const botUserId = authResult.user_id as string;

  const subagentRegistry = buildSubagentRegistry({ gatewayUrl, gatewayToken });

  // Inject tokens into config for the app factory (avoids separate env var requirement)
  const appConfig = { SLACK_BOT_TOKEN: botToken, SLACK_APP_TOKEN: appToken };

  const app = createApp(appConfig, subagentConfig, botUserId, subagentRegistry);
  runningApp = app;
  await app.start();
  log.info(`${subagentConfig.botName} is running in Socket Mode (bot user: ${botUserId})`);

  await postIntroIfNeeded({ client, config: subagentConfig, configPath, logger: log });
}

export async function stopSlackBot(): Promise<void> {
  if (runningApp) {
    await runningApp.stop();
    runningApp = null;
  }
}
