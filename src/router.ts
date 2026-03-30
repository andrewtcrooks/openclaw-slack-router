import type { SubagentConfig } from "./types.js";

export interface RouteResult {
  agentName: string;
  text: string;
}

export class UnknownAgentError extends Error {
  constructor(
    public readonly requestedAgent: string,
    public readonly availableAgents: string[],
  ) {
    super(
      `Unknown agent "${requestedAgent}". Available agents: ${availableAgents.join(", ")}`,
    );
    this.name = "UnknownAgentError";
  }
}

// Slack encodes mentions as <@UXXXXXX> — strip any leading mention
const MENTION_RE = /^<@[A-Z0-9]+>\s*/;
// /agentname message body
const SLASH_PREFIX_RE = /^\/(\w+)\s+([\s\S]*)$/;
// agentname: message body
const COLON_PREFIX_RE = /^(\w+):\s+([\s\S]*)$/;

export function resolveRoute(
  rawText: string,
  _botUserId: string,
  config: SubagentConfig,
): RouteResult {
  // Strip bot mention (present in app_mention, absent in DMs — regex is tolerant)
  const text = rawText.replace(MENTION_RE, "").trim();

  let agentName: string | null = null;
  let message = text;

  const slashMatch = text.match(SLASH_PREFIX_RE);
  if (slashMatch) {
    agentName = slashMatch[1].toLowerCase();
    message = slashMatch[2].trim();
  } else {
    const colonMatch = text.match(COLON_PREFIX_RE);
    if (colonMatch) {
      agentName = colonMatch[1].toLowerCase();
      message = colonMatch[2].trim();
    }
  }

  const resolvedName = agentName ?? config.defaultAgent;

  if (!config.agents[resolvedName]) {
    throw new UnknownAgentError(resolvedName, Object.keys(config.agents));
  }

  return { agentName: resolvedName, text: message };
}
