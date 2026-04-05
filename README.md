# openclaw-slack-router

A Slack plugin for [openclaw](https://github.com/openclaw/openclaw). Each Slack channel is an isolated project context — no cross-project bleed, managed entirely through chat.

## How it works

- Each Slack channel is a separate project context (`#project-a` and `#project-b` never share history)
- Mention the bot in any registered channel — it sends your message to openclaw and replies in-thread
- Manage channels by chatting with the bot in your main channel

## Setup

### 1. Create a Slack app

In the [Slack app console](https://api.slack.com/apps), create a new app and configure:

- **Socket Mode** — enable it under Settings → Socket Mode, generate an App Token (`xapp-...`) under Settings → Basic Information → App-Level Tokens
- **Bot Token** — under OAuth & Permissions → Install to Workspace, copy the Bot OAuth Token (`xoxb-...`)
- **OAuth scopes:** `app_mentions:read`, `channels:history`, `channels:join`, `channels:manage`, `chat:write`, `groups:history`, `im:history`
- **Event subscriptions:** `app_mention`, `message.im`

### 2. Install the plugin

<!-- AUTO:install-cmd -->
```
openclaw plugins install @datanovallc/openclaw-slack-router@0.1.25
```
<!-- /AUTO:install-cmd -->

### 3. Configure your tokens

```
openclaw slack setup
```

The wizard asks for your Bot Token, App Token, and gateway URL. It saves them to `~/.openclaw/.env`.

### 4. Create your main channel in Slack

In Slack, create a channel (e.g. `#rook-main`) and invite your bot user to it.

### 5. Set the main channel ID

Right-click the channel in Slack → **View channel details** → copy the channel ID (starts with `C`).

The setup wizard (step 3) asks for this ID — if you provided it there, skip this step.

Otherwise, add it to the config file at `~/.openclaw/openclaw-slack-router.config.json`:
```json
{
  "mainChannelId": "CXXXXXXXXX"
}
```

### 6. Restart openclaw

```
openclaw gateway restart
```

The bot posts a welcome message in your main channel on first start.

## Using the bot

### Create project channels

In your main channel, tell the bot:

<!-- AUTO:bot-commands -->
| Say this | What happens |
|----------|-------------|
| `new channel my-project` | Create a new project channel (e.g. `new channel my-project`) |
| `list channels` | Show all active channels |
| `remove channel my-project` | Deactivate a channel |
| `help` | Shows available commands |
<!-- /AUTO:bot-commands -->

### Chat in a project channel

Mention the bot to send a message to openclaw:

```
@YourBot what's the status of the API migration?
```

Route to a specific agent:
```
@YourBot /research find recent papers on RAG architectures
```

## Environment variables

Set in `~/.openclaw/.env` by the setup wizard.

<!-- AUTO:env-vars -->
| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | Slack bot OAuth token (xoxb-...) |
| `SLACK_APP_TOKEN` | Yes | Slack app-level token for Socket Mode (xapp-...) |
| `OPENCLAW_GATEWAY_URL` | No | openclaw gateway WebSocket URL |
| `OPENCLAW_GATEWAY_TOKEN` | No | Gateway auth token (if your gateway requires one) |
<!-- /AUTO:env-vars -->

## Configuration file

`openclaw-slack-router.config.json` lives in openclaw's state directory and is managed by the bot. You can also edit it directly:

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

<!-- AUTO:config-fields -->
| Field | Description |
|-------|-------------|
| `botName` | Display name used in logs and error messages |
| `mainChannelId` | Channel ID of your admin/control channel |
| `introPosted` | Set to `true` after the bot posts its first intro — prevents re-posting on restart |
| `defaultAgent` | Which agent handles unrouted messages |
| `agents` | Registered agent names and descriptions |
| `channels` | Active project channels; `historyLimit` controls how many messages are fetched for context |
<!-- /AUTO:config-fields -->

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
