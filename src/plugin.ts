import { startSlackBot, stopSlackBot } from "./bot.js";
import { runInit } from "./commands/init.js";
import { DEFAULT_CONFIG_PATH, loadSubagentConfig, saveSubagentConfig } from "./config.js";

// Minimal types for the openclaw plugin API — no runtime dependency on openclaw required.
// The full types are at openclaw/plugin-sdk if you want to import them as a dev dep.
type PluginServiceContext = {
  config: Record<string, unknown>;
  stateDir: string;
  logger: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
};

type PluginApi = {
  pluginConfig?: Record<string, unknown>;
  registerService: (service: {
    id: string;
    start: (ctx: PluginServiceContext) => void | Promise<void>;
    stop?: () => void | Promise<void>;
  }) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCli: (registrar: (ctx: { program: any }) => void, opts?: { commands?: string[] }) => void;
};

type PluginConfig = {
  botToken?: string;
  appToken?: string;
  mainChannelId?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
};

const plugin = {
  id: "@datanovallc/openclaw-slack-router",
  name: "Slack Router",
  description:
    "Connect openclaw to Slack with per-channel context isolation. Each Slack channel is an isolated project context — managed via chat.",
  configSchema: {
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        botToken: {
          type: "string",
          description: "Slack bot OAuth token (xoxb-...)",
        },
        appToken: {
          type: "string",
          description: "Slack app-level token for Socket Mode (xapp-...)",
        },
        mainChannelId: {
          type: "string",
          description:
            "Channel ID of the admin channel where you manage project channels via chat",
        },
        gatewayUrl: {
          type: "string",
          description: "openclaw gateway WebSocket URL",
          default: "ws://127.0.0.1:18789",
        },
        gatewayToken: {
          type: "string",
          description: "Gateway auth token (if your gateway requires one)",
        },
      },
      required: [],
    },
    uiHints: {
      botToken: { label: "Bot Token", sensitive: true, placeholder: "xoxb-..." },
      appToken: {
        label: "App Token (Socket Mode)",
        sensitive: true,
        placeholder: "xapp-...",
      },
      mainChannelId: {
        label: "Main Channel ID",
        help: "The admin channel where you create and manage project channels by chatting with the bot",
        placeholder: "C...",
      },
      gatewayUrl: {
        label: "Gateway URL",
        placeholder: "ws://127.0.0.1:18789",
      },
      gatewayToken: {
        label: "Gateway Token",
        sensitive: true,
      },
    },
  },

  register(api: PluginApi) {
    const pluginCfg = (api.pluginConfig ?? {}) as PluginConfig;

    if (!pluginCfg.botToken && !pluginCfg.appToken) {
      console.warn(
        "\n⚠️  openclaw-slack-router: Slack tokens not configured.\n" +
        "   Run `openclaw slack setup` before starting the gateway.\n",
      );
    }

    api.registerService({
      id: "openclaw-slack-router",

      async start(ctx) {
        await startSlackBot({
          botToken: pluginCfg.botToken,
          appToken: pluginCfg.appToken,
          gatewayUrl: pluginCfg.gatewayUrl,
          gatewayToken: pluginCfg.gatewayToken,
          configPath: DEFAULT_CONFIG_PATH,
          logger: ctx.logger,
        });
      },

      stop: stopSlackBot,
    });

    api.registerCli(
      (ctx) => {
        const cmd = ctx.program
          .command("slack")
          .description("Slack router plugin commands");

        cmd
          .command("setup")
          .description("Interactive setup wizard — configure tokens and main channel")
          .action(runInit);

        cmd
          .command("reset-intro")
          .description("Clear the introPosted flag so the bot re-posts its welcome message on next gateway restart")
          .action(() => {
            const config = loadSubagentConfig(DEFAULT_CONFIG_PATH);
            config.introPosted = false;
            saveSubagentConfig(config, DEFAULT_CONFIG_PATH);
            console.log("✅ introPosted reset. Restart the gateway to re-post the welcome message.");
          });
      },
      { commands: ["slack"] },
    );
  },
};

export default plugin;
