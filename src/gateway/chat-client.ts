import WebSocket from "ws";
import { randomUUID } from "node:crypto";

export interface GatewayChatOptions {
  url: string;
  token?: string;
  timeoutMs?: number;
}

export interface ChatSendResult {
  text: string;
  runId: string;
}

export async function gatewayChatSend(
  options: GatewayChatOptions,
  params: { sessionKey: string; message: string; idempotencyKey: string },
): Promise<ChatSendResult> {
  const { url, token, timeoutMs = 120_000 } = options;
  const { sessionKey, message, idempotencyKey } = params;

  return new Promise<ChatSendResult>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(url, { maxPayload: 25 * 1024 * 1024 });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error(`gateway timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      ws.close();
    };

    const sendReq = (method: string, reqParams: unknown): string => {
      const id = randomUUID();
      ws.send(JSON.stringify({ type: "req", id, method, params: reqParams }));
      return id;
    };

    let connectReqId: string | null = null;
    let chatSendReqId: string | null = null;
    let chatRunId: string | null = null;
    let deltaText = "";

    ws.on("open", () => {
      /* wait for connect.challenge event */
    });

    ws.on("message", (data) => {
      if (settled) return;
      const raw = typeof data === "string" ? data : data.toString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let frame: any;
      try {
        frame = JSON.parse(raw);
      } catch {
        return;
      }

      // Event frames
      if (frame.type === "evt") {
        if (frame.event === "connect.challenge") {
          connectReqId = sendReq("connect", {
            minProtocol: 1,
            maxProtocol: 1,
            client: {
              id: "slack-router",
              version: "0.1.0",
              platform: process.platform,
              mode: "backend",
            },
            caps: [],
            role: "operator",
            scopes: ["operator.admin"],
            ...(token ? { auth: { token } } : {}),
          });
          return;
        }
        if (frame.event === "chat") {
          const p = frame.payload;
          if (p?.runId !== chatRunId) return;

          if (p.state === "delta" && p.message) {
            const content = p.message.content as
              | Array<{ type: string; text?: string }>
              | undefined;
            const text =
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content?.find((c: any) => c.type === "text")?.text ?? "";
            if (text) deltaText = text; // delta text is cumulative
          }

          if (p.state === "final") {
            settled = true;
            const text = extractTextFromMessage(p.message) || deltaText;
            cleanup();
            resolve({ text, runId: chatRunId! });
            return;
          }
          if (p.state === "error") {
            settled = true;
            cleanup();
            reject(new Error(p.errorMessage ?? "gateway chat error"));
            return;
          }
          if (p.state === "aborted") {
            settled = true;
            cleanup();
            reject(new Error("gateway chat aborted"));
            return;
          }
        }
        return;
      }

      // Response frames
      if (frame.type === "res") {
        if (frame.id === connectReqId) {
          if (!frame.ok) {
            settled = true;
            cleanup();
            reject(
              new Error(frame.error?.message ?? "gateway connect failed"),
            );
            return;
          }
          // Connected -- send chat.send
          chatSendReqId = sendReq("chat.send", {
            sessionKey,
            message,
            idempotencyKey,
          });
          return;
        }
        if (frame.id === chatSendReqId) {
          if (!frame.ok) {
            settled = true;
            cleanup();
            reject(new Error(frame.error?.message ?? "chat.send failed"));
            return;
          }
          chatRunId = frame.payload?.runId ?? idempotencyKey;
          // Now wait for chat events...
          return;
        }
      }
    });

    ws.on("error", (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    ws.on("close", (code, reason) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(
          new Error(
            `gateway closed (${code}): ${reason?.toString() ?? ""}`,
          ),
        );
      }
    });
  });
}

function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as Record<string, unknown>;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return (msg.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n");
  }
  if (typeof msg.text === "string") return msg.text;
  return "";
}
