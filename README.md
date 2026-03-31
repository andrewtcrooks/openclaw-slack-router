# openclaw-slack-router

A Slack router plugin for [openclaw](https://github.com/openclaw/openclaw). Connect your openclaw agent to Slack with per-channel context isolation — each channel is an independent project context, managed entirely through chat.

## How it works

1. Install via openclaw's plugin system
2. Configure your Slack tokens (`openclaw config set ...` or `openclaw slack setup`)
3. Start openclaw — the Slack bot starts automatically as a service
4. Your main channel posts setup instructions on first start
5. Say `new channel my-project` in the main channel to create a project channel
6. Mention the bot in any project channel — it routes your message to openclaw and replies in-thread
7. Each channel maintains its own context — `#project-a` and `#project-b` never bleed into each other

## Install

```
openclaw plugins install npm:@datanovallc/openclaw-slack-router
```

Then restart your openclaw gateway:

```
openclaw gateway restart
```

## Quick start

### 1. Create a Slack app

In the [Slack app console](https://api.slack.com/apps):

- **Enable Socket Mode** — generate an App Token (`xapp-...`) under Settings → Basic Information
- **Add a Bot Token** (`xoxb-...`) under OAuth & Permissions → Install to Workspace
- **Required OAuth scopes:** `app_mentions:read`, `chat:write`, `channels:history`, `channels:join`, `channels:manage`, `groups:history`, `im:history`, `im:write`
- **Subscribe to bot events:** `app_mention`, `message.im`

### 2. Run the setup wizard

```
npx openclaw-slack-router init
```

The wizard asks for your tokens, gateway URL, and a name for your main channel. It writes `.env` and `openclaw-slack-router.config.json`.

### 3. Invite the bot to your main channel

Create the channel you named during setup, then invite your bot user to it. Copy the channel ID (right-click the channel → View channel details → copy the ID starting with `C...`), then add it to `openclaw-slack-router.config.json`:

```json
{
  "mainChannelId": "CXXXXXXXXX"
}
```

### 4. Start

```
npx openclaw-slack-router start
```

Or if installed locally:

```
npm start
```

On first start, the bot posts a welcome message in your main channel with instructions for creating project channels.

## Managing channels via chat

Everything is done by talking to the bot in your main channel:

| Say this | What happens |
|----------|-------------|
| `new channel my-project` | Creates `#my-project` in Slack, joins it, registers it for routing |
| `list channels` | Shows all registered project channels |
| `remove channel my-project` | Unregisters the channel (Slack channel still exists) |
| `help` | Shows available commands |

## Routing messages

In any project channel, mention the bot:

```
@YourBot what's the status of the API migration?
```

To route to a specific agent explicitly:

```
@YourBot /research find recent papers on RAG architectures
@YourBot research: find recent papers on RAG architectures
```

If no agent prefix is given, the message goes to the default agent (openclaw-gateway).

## Configuration

`openclaw-slack-router.config.json` is created by `init` and managed by the bot. You can also edit it directly:

```json
{
  "botName": "Rook",
  "mainChannelId": "CXXXXXXXXX",
  "introPosted": false,
  "defaultAgent": "default",
  "agents": {
    "default": {
      "name": "openclaw-gateway",
      "description": "Routes messages through the local openclaw gateway"
    }
  },
  "channels": {
    "C1234567890": {
      "name": "my-project",
      "historyLimit": 50
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `botName` | Display name used in logs and error messages |
| `mainChannelId` | Channel ID of your admin/control channel |
| `introPosted` | Set to `true` after the bot posts its first intro — prevents re-posting on restart |
| `defaultAgent` | Which agent handles unrouted messages |
| `agents` | Registered agent names and descriptions |
| `channels` | Active project channels; `historyLimit` controls how many messages are fetched for context |

**This file is gitignored** — your channel config and tokens stay local.

## Environment variables

The plugin reads these from `~/.openclaw/.env` (openclaw's canonical env file). The setup wizard (`openclaw slack setup`) writes them there automatically.

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | Bot OAuth token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Yes | Socket Mode app token (`xapp-...`) |
| `OPENCLAW_GATEWAY_URL` | No | Gateway WebSocket URL (default: `ws://127.0.0.1:18789`) |
| `OPENCLAW_GATEWAY_TOKEN` | No | Gateway auth token if your gateway requires one |

## Channel context model

Each Slack channel is an isolated project context:

- `#project-openclaw` only sees openclaw conversation history
- `#project-datanova` only sees datanova history
- No cross-project token burn, no context bleed

Context is built from **full channel history** (`conversations.history`), not individual thread replies. Threads are for sub-discussions — the context sent to openclaw is always the whole channel.

## Adding a custom subagent

Implement the `SubagentDefinition` interface:

```typescript
import type { SubagentDefinition, SubagentContext } from "openclaw-slack-router";

const myAgent: SubagentDefinition = {
  name: "my-agent",
  description: "Does something useful",
  async handle(ctx: SubagentContext): Promise<string> {
    // ctx.currentMessage  — the current message text
    // ctx.threadHistory   — [{role, content}] full channel history
    // ctx.channelId       — Slack channel ID
    // ctx.userId          — Slack user ID who sent the message
    // ctx.threadTs        — thread timestamp to reply into
    return "response text";
  },
};
```

Register it in `src/subagents/index.ts` alongside `openclaw-gateway`.

## Development

```
npm run dev       # watch mode with tsx
npm test          # run tests
npm run typecheck # type check without emitting
npm run build     # compile to dist/
```
