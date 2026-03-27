# Phase 1: Slack Foundation - Research

**Researched:** 2026-03-27
**Domain:** Slack Bot (Socket Mode) with @slack/bolt in TypeScript
**Confidence:** HIGH

## Summary

Phase 1 establishes the Slack connection foundation: a standalone TypeScript/Node.js service using `@slack/bolt` v4.6.0 in Socket Mode. The service must handle two event types (app_mention in channels, message events in DMs), reply in-thread, join channels on demand, and validate environment configuration at startup.

The reference codebase at `/Users/andrew/git/openclaw/src/slack/` demonstrates proven patterns for all of these requirements using `@slack/bolt`. The key patterns are: `new App({ token, appToken, socketMode: true })` for Socket Mode setup, `app.event("app_mention", ...)` and `app.event("message", ...)` for event handling, and `thread_ts` management for in-thread replies. The service is simple enough that no complex architectural decisions are needed -- the primary risk is misconfiguring event subscriptions or mishandling `thread_ts` for in-thread replies.

**Primary recommendation:** Use `@slack/bolt` v4.6.0 with the built-in `socketMode: true` flag (not a manual SocketModeReceiver). Validate env vars with zod at startup. Keep the project structure flat and minimal for Phase 1.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLACK-01 | Rook receives app mentions in public channels it has joined | `app.event("app_mention", handler)` -- bolt built-in event |
| SLACK-02 | Rook receives direct messages from users | `app.event("message", handler)` filtering for `channel_type === "im"` |
| SLACK-03 | Rook replies within the Slack thread of the triggering message | Use `say({ text, thread_ts })` or `client.chat.postMessage` with `thread_ts` |
| SLACK-04 | Bot token and app token are loaded from environment variables | `process.env.SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` validated via zod |
| SLACK-05 | Service operates in Socket Mode | `new App({ token, appToken, socketMode: true })` |
| SLACK-06 | Rook can join public channels on demand | `client.conversations.join({ channel })` on first mention |
| CFG-01 | Subagent routing table defined in config file | Stub config file with zod schema; actual routing is Phase 2 |
| CFG-02 | Service reads SLACK_BOT_TOKEN and SLACK_APP_TOKEN from env | dotenv + zod validation at startup |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @slack/bolt | 4.6.0 | Slack app framework (events, Socket Mode, Web API) | Official Slack SDK; handles Socket Mode, event routing, middleware |
| typescript | 5.8.x (latest 5.x) | Type safety | Project constraint; matches openclaw ecosystem |
| tsx | 4.21.0 | TypeScript execution (dev) | Zero-config TS runner, faster than ts-node |
| zod | 3.24.x | Config/env validation | Standard for runtime validation in TS ecosystem |
| dotenv | 16.5.x (latest 16.x) | Load .env files | Standard env loading; used in dev only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | latest | Node.js type definitions | Always (dev dependency) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod | Manual validation | zod gives typed output + clear error messages; manual is error-prone |
| dotenv | Direct process.env | dotenv only needed for local dev; production uses real env vars |
| tsx | ts-node | tsx is faster, zero-config; ts-node needs tsconfig-paths config |

**Installation:**
```bash
npm install @slack/bolt zod dotenv
npm install -D typescript tsx @types/node
```

**Version verification:** All versions confirmed via `npm view` on 2026-03-27.

## Architecture Patterns

### Recommended Project Structure
```
openclaw-slack-router/
├── src/
│   ├── index.ts              # Entry point: validate config, create App, start
│   ├── config.ts             # Env validation (zod), config types
│   ├── app.ts                # Bolt App factory: createApp() returns configured App
│   ├── events/
│   │   ├── app-mention.ts    # app_mention event handler
│   │   └── message.ts        # message event handler (DMs)
│   ├── handlers/
│   │   └── reply.ts          # Shared reply-in-thread logic
│   └── types.ts              # Shared types (stub SubagentConfig for CFG-01)
├── subagent-config.json      # Routing table stub (CFG-01)
├── .env.example              # Template for required env vars
├── package.json
├── tsconfig.json
└── .gitignore
```

### Pattern 1: Socket Mode App Construction
**What:** Create a Bolt App with Socket Mode enabled via the `socketMode: true` flag.
**When to use:** Always for this project (Socket Mode is a locked decision).
**Example:**
```typescript
// Source: Reference codebase /Users/andrew/git/openclaw/src/slack/monitor/provider.ts lines 142-155
import { App } from "@slack/bolt";

const app = new App({
  token: config.slackBotToken,    // xoxb- token
  appToken: config.slackAppToken, // xapp- token
  socketMode: true,
});

await app.start();
console.log("Rook is connected to Slack");
```

### Pattern 2: Event Handlers for Mentions and DMs
**What:** Register separate handlers for `app_mention` and `message` events.
**When to use:** Always -- these are the two ingress paths.
**Example:**
```typescript
// Source: Reference codebase /Users/andrew/git/openclaw/src/slack/monitor/events/messages.ts
// app_mention fires when @Rook is mentioned in a channel
app.event("app_mention", async ({ event, say }) => {
  const threadTs = event.thread_ts ?? event.ts;
  await say({
    text: `Hello <@${event.user}>! (stub reply)`,
    thread_ts: threadTs,
  });
});

// message fires for DMs (channel_type === "im")
app.event("message", async ({ event, say }) => {
  // Filter: only handle DMs, skip subtypes (edits, deletes)
  if (event.channel_type !== "im" || event.subtype) return;
  // Skip bot's own messages
  if (event.bot_id) return;

  const threadTs = event.thread_ts ?? event.ts;
  await say({
    text: `Hello! (stub reply)`,
    thread_ts: threadTs,
  });
});
```

### Pattern 3: Thread-ts Resolution for In-Thread Replies
**What:** Always reply in-thread by setting `thread_ts`. For top-level messages, use `event.ts` as thread_ts (creates a new thread). For messages already in a thread, use `event.thread_ts`.
**When to use:** Every reply.
**Example:**
```typescript
// Source: Reference codebase /Users/andrew/git/openclaw/src/slack/threading.ts
function resolveThreadTs(event: { ts?: string; thread_ts?: string }): string {
  // If message is already in a thread, reply in that thread
  // If top-level, use message ts to start a new thread
  return event.thread_ts ?? event.ts!;
}
```

### Pattern 4: Channel Join on First Mention
**What:** When Rook gets mentioned in a channel it is not yet in, call `conversations.join`.
**When to use:** SLACK-06 -- join public channels on demand.
**Example:**
```typescript
app.event("app_mention", async ({ event, client, say }) => {
  // Attempt to join the channel (idempotent for already-joined channels)
  try {
    await client.conversations.join({ channel: event.channel });
  } catch (err) {
    // May fail for private channels (need invite); log and continue
    console.warn(`Could not join channel ${event.channel}:`, err);
  }

  const threadTs = event.thread_ts ?? event.ts;
  await say({ text: "Hello!", thread_ts: threadTs });
});
```

### Pattern 5: Startup Config Validation
**What:** Validate all required env vars at startup, fail fast with clear errors.
**When to use:** Always -- at service entry point.
**Example:**
```typescript
import { z } from "zod";

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-", "Must be a bot token (xoxb-)"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-", "Must be an app token (xapp-)"),
});

export function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Missing or invalid configuration:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}
```

### Anti-Patterns to Avoid
- **Replying without thread_ts:** Every reply MUST include `thread_ts`. Omitting it posts a top-level message, cluttering the channel.
- **Using SocketModeReceiver manually:** The `socketMode: true` flag in `App` constructor handles this internally. Only use `SocketModeReceiver` if you need custom receiver behavior.
- **Handling message events without filtering subtypes:** The `message` event fires for edits, deletes, and thread broadcasts too. Always check `event.subtype` and `event.bot_id`.
- **Not handling bot self-messages:** Without filtering `bot_id`, the bot can trigger infinite reply loops on its own messages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection to Slack | Custom WS client | `@slack/bolt` socketMode: true | Handles reconnection, heartbeats, ack protocol |
| Event type routing | Manual event dispatcher | `app.event()` from bolt | Built-in type-safe event routing with middleware |
| Env validation | Manual if/throw checks | zod schema + safeParse | Typed output, aggregated errors, clear messages |
| Slack API calls | Raw HTTP to api.slack.com | `client` from bolt (WebClient) | Built-in rate limiting, retries, types |
| Token format validation | Regex checks | zod `.startsWith()` | Declarative, composable |

**Key insight:** `@slack/bolt` already handles the entire Socket Mode lifecycle (WebSocket connect, reconnect, event ack, rate limiting). The only code needed is event handler registration and business logic.

## Common Pitfalls

### Pitfall 1: Duplicate Events from app_mention + message
**What goes wrong:** If Rook is mentioned in a channel, BOTH `app_mention` AND `message` events fire. Without dedup, Rook replies twice.
**Why it happens:** Slack sends both event types for @-mentions in channels. In DMs, only `message` fires (no `app_mention` in DMs).
**How to avoid:** Handle `app_mention` for channel mentions and `message` ONLY for DMs (`channel_type === "im"`). The reference codebase uses this exact pattern -- separate handlers with non-overlapping scopes.
**Warning signs:** Double replies in channels.

### Pitfall 2: Missing thread_ts on Top-Level Messages
**What goes wrong:** `event.thread_ts` is `undefined` for top-level (non-threaded) messages. Using it directly as `thread_ts` in `say()` sends `undefined`, which posts a top-level reply.
**Why it happens:** `thread_ts` only exists on messages that are already in a thread.
**How to avoid:** Always use `event.thread_ts ?? event.ts` -- fall back to the message's own timestamp to create a new thread.
**Warning signs:** Bot replies appearing as top-level channel messages instead of in threads.

### Pitfall 3: Bot Responding to Its Own Messages
**What goes wrong:** Infinite loop where bot replies to itself.
**Why it happens:** `message` event fires for ALL messages, including the bot's own. The bot sees its own reply, processes it, replies again.
**How to avoid:** Check `event.bot_id` or compare `event.user` against the bot's own user ID. Skip processing if it's the bot's own message.
**Warning signs:** Exponentially growing message threads.

### Pitfall 4: ESM/CJS Import Issues with @slack/bolt
**What goes wrong:** `import { App } from "@slack/bolt"` may not work correctly depending on Node.js ESM/CJS interop mode.
**Why it happens:** @slack/bolt ships as CJS. Node.js ESM import of CJS modules has edge cases. The reference codebase (lines 38-45 of provider.ts) has a workaround.
**How to avoid:** Use `"type": "module"` in package.json with `tsconfig` `"module": "nodenext"`. If named imports fail, use default import: `import SlackBolt from "@slack/bolt"; const { App } = SlackBolt;`
**Warning signs:** `App is not a constructor` or `undefined` errors at startup.

### Pitfall 5: Socket Mode Requires connections:write Scope
**What goes wrong:** Socket Mode connection fails with auth error.
**Why it happens:** Socket Mode needs the `connections:write` scope on the APP-level token (not the bot token). This is set in the Slack app manifest under app-level tokens, not OAuth scopes.
**How to avoid:** Ensure the app-level token (xapp-) was generated with `connections:write` scope. The OAuth scopes listed in PROJECT.md are bot token scopes; Socket Mode needs a separate app-level token scope.
**Warning signs:** Connection refused or auth errors on startup.

### Pitfall 6: conversations.join Only Works for Public Channels
**What goes wrong:** Calling `conversations.join` on a private channel returns `method_not_supported_for_channel_type` or `channel_not_found`.
**Why it happens:** Bots cannot self-join private channels; they must be invited by a member.
**How to avoid:** Wrap `conversations.join` in try/catch. For private channels, log a warning message suggesting the user invite Rook manually.
**Warning signs:** Error responses from Slack API when mentioned in private channels.

## Code Examples

### Complete Minimal App Setup
```typescript
// src/index.ts
import "dotenv/config";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const app = createApp(config);
  await app.start();
  console.log("Rook is running in Socket Mode");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

### Config Loader with Zod
```typescript
// src/config.ts
import { z } from "zod";

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-", "Must be a bot token (xoxb-)"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-", "Must be an app token (xapp-)"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${messages}`);
  }
  return result.data;
}
```

### App Factory with Event Registration
```typescript
// src/app.ts
import { App } from "@slack/bolt";
import type { AppConfig } from "./config.js";

export function createApp(config: AppConfig): App {
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
  });

  // SLACK-01: Channel mentions
  app.event("app_mention", async ({ event, client, say }) => {
    // SLACK-06: Join channel on mention
    try {
      await client.conversations.join({ channel: event.channel });
    } catch {
      // Private channel or already joined -- continue
    }

    const threadTs = event.thread_ts ?? event.ts;
    await say({ text: `Hello <@${event.user}>!`, thread_ts: threadTs });
  });

  // SLACK-02: Direct messages
  app.event("message", async ({ event, say }) => {
    if (event.channel_type !== "im") return;
    if (event.subtype) return;
    if ("bot_id" in event && event.bot_id) return;

    const threadTs = event.thread_ts ?? event.ts;
    await say({ text: "Hello!", thread_ts: threadTs });
  });

  return app;
}
```

### Subagent Config Stub (CFG-01)
```typescript
// src/types.ts
export interface SubagentEntry {
  name: string;
  description: string;
  // handler will be added in Phase 3
}

export interface SubagentConfig {
  defaultAgent: string;
  agents: Record<string, SubagentEntry>;
}
```

```json
// subagent-config.json
{
  "defaultAgent": "echo",
  "agents": {
    "echo": {
      "name": "echo",
      "description": "Echoes back the user's message (placeholder)"
    }
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### package.json Scripts
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@slack/bolt` v3 with ExpressReceiver | `@slack/bolt` v4 with built-in Socket Mode | v4 (2024) | Cleaner API, less boilerplate |
| `SocketModeReceiver` manual construction | `socketMode: true` flag in App constructor | Bolt v3.8+ | Simpler setup |
| ts-node for dev execution | tsx | 2023-2024 | Faster, zero-config |
| Manual env validation | zod schemas | 2022+ | Type-safe, better DX |

**Deprecated/outdated:**
- `@slack/rtm-api`: Replaced by Socket Mode. RTM is legacy.
- ExpressReceiver for Socket Mode: Unnecessary; the `socketMode: true` flag handles everything.
- `@slack/events-api` standalone: Merged into `@slack/bolt`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (recommended for new TS projects; fast, native ESM) |
| Config file | vitest.config.ts -- needs creation in Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLACK-01 | app_mention event handler fires and replies in thread | unit | `npx vitest run src/events/app-mention.test.ts -t "app_mention"` | No -- Wave 0 |
| SLACK-02 | message event handler fires for DMs only | unit | `npx vitest run src/events/message.test.ts -t "dm"` | No -- Wave 0 |
| SLACK-03 | Reply includes correct thread_ts | unit | `npx vitest run src/handlers/reply.test.ts -t "thread_ts"` | No -- Wave 0 |
| SLACK-04 | Config loads tokens from env | unit | `npx vitest run src/config.test.ts -t "tokens"` | No -- Wave 0 |
| SLACK-05 | App created with socketMode: true | unit | `npx vitest run src/app.test.ts -t "socket"` | No -- Wave 0 |
| SLACK-06 | conversations.join called on mention | unit | `npx vitest run src/events/app-mention.test.ts -t "join"` | No -- Wave 0 |
| CFG-01 | Subagent config file loads and validates | unit | `npx vitest run src/config.test.ts -t "subagent"` | No -- Wave 0 |
| CFG-02 | Missing env vars produce clear error | unit | `npx vitest run src/config.test.ts -t "missing"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- framework config
- [ ] `src/config.test.ts` -- covers CFG-01, CFG-02, SLACK-04
- [ ] `src/app.test.ts` -- covers SLACK-05
- [ ] `src/events/app-mention.test.ts` -- covers SLACK-01, SLACK-06
- [ ] `src/events/message.test.ts` -- covers SLACK-02
- [ ] `src/handlers/reply.test.ts` -- covers SLACK-03
- [ ] Framework install: `npm install -D vitest`

### Testing Strategy Note
Unit tests for bolt event handlers should mock `@slack/bolt`'s `App` class. The pattern is to call the registered event handler directly with mock `event`, `say`, and `client` objects. Do NOT instantiate a real Slack connection in tests.

## Open Questions

1. **ESM/CJS interop with @slack/bolt v4.6.0 on Node 25**
   - What we know: The reference codebase has a CJS/ESM workaround (lines 38-45 of provider.ts). Node 25.x has improved ESM/CJS interop.
   - What's unclear: Whether `import { App } from "@slack/bolt"` works cleanly on Node 25 with `"type": "module"`.
   - Recommendation: Try the clean import first. If it fails, fall back to `import SlackBolt from "@slack/bolt"; const { App } = SlackBolt;`

2. **A:write OAuth scope**
   - What we know: PROJECT.md lists `A:write` as an enabled scope. This appears to be an agent-specific scope.
   - What's unclear: Whether this is a standard Slack scope or a custom/beta feature.
   - Recommendation: Not relevant for Phase 1. The required scopes for Phase 1 are `app_mentions:read`, `chat:write`, `channels:join`, `channels:history`. These are already enabled.

## Sources

### Primary (HIGH confidence)
- Reference codebase `/Users/andrew/git/openclaw/src/slack/` -- proven @slack/bolt patterns for Socket Mode, event handling, threading
- `npm view @slack/bolt` -- version 4.6.0 confirmed, dependencies checked, Node >= 18 requirement
- `npm view typescript` -- version 5.8.x latest confirmed (6.0.2 is latest but 5.x is stable)

### Secondary (MEDIUM confidence)
- @slack/bolt dependency tree shows `@slack/socket-mode@2.0.5` is bundled -- no separate install needed
- Reference codebase ESM/CJS workaround pattern (may or may not be needed on Node 25)

### Tertiary (LOW confidence)
- TypeScript 5.8.x vs 6.0.x choice -- TypeScript 6.0.2 is available but is very new (2026); 5.8.x is more battle-tested. Given this is a new greenfield project, either works. Recommend 5.8.x for stability unless the team prefers latest.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm, patterns proven in reference codebase
- Architecture: HIGH -- patterns directly extracted from working reference implementation
- Pitfalls: HIGH -- pitfalls 1-4 observed in reference codebase workarounds; pitfalls 5-6 are well-documented Slack behaviors

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain; @slack/bolt release cadence is ~monthly)
