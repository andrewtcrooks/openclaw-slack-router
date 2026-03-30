# openclaw-slack-router

Rook is a Slack bot that receives messages in Socket Mode and routes them to subagents. Each Slack channel is an isolated project context — `#rook-openclaw` only sees openclaw history, `#rook-datanova` only sees datanova history.

## How it works

1. Someone mentions `@Rook` in a channel (or sends a DM)
2. Rook fetches full channel history via `conversations.history`
3. The message is routed to the appropriate subagent
4. The subagent receives the message + full channel history as context
5. The response is posted back in-thread

## Setup

### 1. Create a Slack app

In the [Slack app console](https://api.slack.com/apps):

- Enable **Socket Mode** and generate an App Token (`xapp-...`)
- Add a Bot Token (`xoxb-...`) under OAuth & Permissions
- Required OAuth scopes: `app_mentions:read`, `chat:write`, `channels:history`, `channels:join`, `groups:history`, `im:history`, `im:write`
- Subscribe to bot events: `app_mention`, `message.im`

### 2. Install dependencies

```
npm install
```

### 3. Configure environment

Create a `.env` file:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

# Optional: openclaw gateway (defaults to ws://127.0.0.1:18789)
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here
```

### 4. Configure routing

Edit `subagent-config.json`:

```json
{
  "defaultAgent": "openclaw-gateway",
  "agents": {
    "openclaw-gateway": {
      "name": "openclaw-gateway",
      "description": "Routes messages through the local openclaw gateway"
    }
  },
  "channelConfig": {
    "C1234567890": {
      "historyLimit": 50
    }
  }
}
```

- `defaultAgent` — which agent handles unrouted messages
- `agents` — registered agent names (must match a registered `SubagentDefinition`)
- `channelConfig` — per-channel overrides keyed by Slack channel ID; `historyLimit` controls how many messages are fetched for context (default: Slack API default)

### 5. Run

```
# Development (watch mode)
npm run dev

# Production
npm run build
npm start
```

## Usage in Slack

**Route to default agent** (implicit):
```
@Rook what's the status of the permit scraper?
```

**Route to a specific agent** (slash prefix):
```
@Rook /research find me information about X
```

**Route to a specific agent** (colon prefix):
```
@Rook research: find me information about X
```

If you request an unknown agent, Rook replies with an error listing the available agents.

## Channel model

Each Slack channel maps to one isolated project context:

- `#rook-openclaw` → openclaw context only
- `#rook-datanova` → datanova context only

Context is built from **channel history** (`conversations.history`), not thread replies. Threads inside a channel are lightweight sub-discussions — Rook replies in-thread for readability, but the context sent to the subagent is always the full channel history.

## Adding a subagent

Implement the `SubagentDefinition` interface:

```typescript
import type { SubagentDefinition, SubagentContext } from "./src/subagents/types.js";

const mySubagent: SubagentDefinition = {
  name: "my-agent",
  description: "Does something useful",
  async handle(ctx: SubagentContext): Promise<string> {
    // ctx.currentMessage — the current message text
    // ctx.threadHistory  — [{role, content}] channel history
    // ctx.channelId      — Slack channel ID
    // ctx.userId         — Slack user ID
    // ctx.threadTs       — thread timestamp to reply into
    return "response text";
  },
};
```

Then register it in `src/subagents/index.ts` alongside `openclaw-gateway`.

## The openclaw-gateway subagent

The built-in subagent connects to a local openclaw gateway over WebSocket. The gateway protocol:

1. Receives a `connect.challenge` event
2. Sends `connect` request (with optional auth token)
3. Sends `chat.send` with `{ sessionKey, message, idempotencyKey }`
4. Streams `chat` events until `state: "final"` or `state: "error"`

The `sessionKey` is the Slack channel ID, so each channel maintains a separate conversation session in the gateway.

## Development

```
npm test          # run tests
npm run typecheck # type check without emitting
```
