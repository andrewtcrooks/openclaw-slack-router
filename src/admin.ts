import type { SubagentConfig } from "./types.js";
import { saveSubagentConfig } from "./config.js";

export const INTRO_MESSAGE = `👋 *openclaw-slack-router is connected!*

I'm your Slack-to-openclaw router. Each channel you create here becomes an isolated project context — messages in one channel never bleed into another.

*Managing channels (type these here):*
• \`new channel <name>\` — create a new project channel (e.g. \`new channel my-project\`)
• \`list channels\` — show all active channels
• \`remove channel <name>\` — deactivate a channel

Once a channel is created, mention me in it and I'll start routing your messages to openclaw.`;

// Matches: "new channel foo-bar", "new channel foo bar" (spaces become hyphens)
const NEW_CHANNEL_RE = /^new channel\s+(.+)$/i;
// Matches: "remove channel foo-bar"
const REMOVE_CHANNEL_RE = /^remove channel\s+(\S+)$/i;
// Matches: "list channels" or "list channel"
const LIST_CHANNELS_RE = /^list channels?$/i;
// Matches: "help"
const HELP_RE = /^help$/i;

export function parseAdminCommand(
  text: string,
): { type: "new"; name: string } | { type: "remove"; name: string } | { type: "list" } | { type: "help" } | null {
  const trimmed = text.trim();

  const newMatch = trimmed.match(NEW_CHANNEL_RE);
  if (newMatch) {
    const name = newMatch[1].trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return { type: "new", name };
  }

  const removeMatch = trimmed.match(REMOVE_CHANNEL_RE);
  if (removeMatch) return { type: "remove", name: removeMatch[1].toLowerCase() };

  if (LIST_CHANNELS_RE.test(trimmed)) return { type: "list" };
  if (HELP_RE.test(trimmed)) return { type: "help" };

  return null;
}

export async function handleAdminCommand(params: {
  text: string;
  client: any;
  threadTs: string;
  config: SubagentConfig;
  configPath?: string;
}): Promise<string | null> {
  const { text, client, config, configPath } = params;
  const cmd = parseAdminCommand(text);
  if (!cmd) return null;

  if (cmd.type === "help") {
    return INTRO_MESSAGE;
  }

  if (cmd.type === "list") {
    const entries = Object.entries(config.channels);
    if (entries.length === 0) return "No project channels configured yet. Say `new channel <name>` to create one.";
    const lines = entries.map(([id, ch]) => `• *#${ch.name}* (${id})`).join("\n");
    return `*Active channels:*\n${lines}`;
  }

  if (cmd.type === "new") {
    const channelName = cmd.name;
    // Check if already registered by name
    const existing = Object.values(config.channels).find((ch) => ch.name === channelName);
    if (existing) return `A channel named *#${channelName}* is already registered.`;

    try {
      const result = await client.conversations.create({ name: channelName });
      const channelId: string = result.channel.id;
      await client.conversations.join({ channel: channelId });

      config.channels[channelId] = { name: channelName };
      saveSubagentConfig(config, configPath);

      return `✅ Created and joined *#${channelName}* (\`${channelId}\`). Mention me there to start routing messages to openclaw.`;
    } catch (err: any) {
      const code: string = err?.data?.error ?? err?.message ?? String(err);
      if (code === "name_taken") return `A Slack channel named *#${channelName}* already exists. To register an existing channel, mention me in it directly.`;
      return `Failed to create channel: ${code}`;
    }
  }

  if (cmd.type === "remove") {
    const channelName = cmd.name;
    const entry = Object.entries(config.channels).find(([, ch]) => ch.name === channelName);
    if (!entry) return `No registered channel named *#${channelName}*. Say \`list channels\` to see what's active.`;

    const [channelId] = entry;
    delete config.channels[channelId];
    saveSubagentConfig(config, configPath);

    return `✅ Removed *#${channelName}* from routing. The Slack channel still exists but I'll no longer respond there.`;
  }

  return null;
}

export async function postIntroIfNeeded(params: {
  client: any;
  config: SubagentConfig;
  configPath?: string;
}): Promise<void> {
  const { client, config, configPath } = params;
  if (!config.mainChannelId) return;
  if (config.introPosted) return;

  try {
    await client.chat.postMessage({
      channel: config.mainChannelId,
      text: INTRO_MESSAGE,
      mrkdwn: true,
    });

    config.introPosted = true;
    saveSubagentConfig(config, configPath);
  } catch {
    // Non-fatal: channel may not exist yet or bot not invited
  }
}
