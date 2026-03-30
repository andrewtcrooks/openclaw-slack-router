import { describe, it, expect, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import { gatewayChatSend } from "./chat-client.js";
import { randomUUID } from "node:crypto";

let wss: WebSocketServer | null = null;

function startMockGateway(
  handler: (ws: import("ws").WebSocket) => void,
): Promise<number> {
  return new Promise((resolve) => {
    wss = new WebSocketServer({ port: 0 });
    wss.on("connection", handler);
    wss.on("listening", () => {
      const addr = wss!.address();
      resolve(typeof addr === "object" && addr !== null ? addr.port : 0);
    });
  });
}

afterEach(async () => {
  if (wss) {
    await new Promise<void>((resolve) => {
      wss!.close(() => resolve());
    });
    wss = null;
  }
});

/**
 * Helper: run the standard connect.challenge -> connect response -> chat.send ack
 * sequence, then call `onReady` with the runId so the test can send chat events.
 */
function fullHandshake(
  ws: import("ws").WebSocket,
  onReady: (runId: string, ws: import("ws").WebSocket) => void,
) {
  const nonce = randomUUID();
  const runId = randomUUID();

  // Send connect.challenge
  ws.send(
    JSON.stringify({
      type: "evt",
      event: "connect.challenge",
      payload: { nonce },
    }),
  );

  ws.on("message", (data) => {
    const frame = JSON.parse(data.toString());

    if (frame.type === "req" && frame.method === "connect") {
      // Respond to connect
      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: {},
        }),
      );
      return;
    }

    if (frame.type === "req" && frame.method === "chat.send") {
      // Ack chat.send
      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: { runId },
        }),
      );
      onReady(runId, ws);
      return;
    }
  });
}

describe("gatewayChatSend", () => {
  it("completes full handshake and returns final chat response", async () => {
    const port = await startMockGateway((ws) => {
      fullHandshake(ws, (runId, sock) => {
        sock.send(
          JSON.stringify({
            type: "evt",
            event: "chat",
            payload: {
              runId,
              state: "final",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "Hello from gateway" }],
              },
            },
          }),
        );
      });
    });

    const result = await gatewayChatSend(
      { url: `ws://127.0.0.1:${port}` },
      {
        sessionKey: "C123",
        message: "hi",
        idempotencyKey: randomUUID(),
      },
    );

    expect(result.text).toBe("Hello from gateway");
    expect(result.runId).toBeTruthy();
  });

  it("rejects on chat error event", async () => {
    const port = await startMockGateway((ws) => {
      fullHandshake(ws, (runId, sock) => {
        sock.send(
          JSON.stringify({
            type: "evt",
            event: "chat",
            payload: {
              runId,
              state: "error",
              errorMessage: "session not found",
            },
          }),
        );
      });
    });

    await expect(
      gatewayChatSend(
        { url: `ws://127.0.0.1:${port}` },
        {
          sessionKey: "C123",
          message: "hi",
          idempotencyKey: randomUUID(),
        },
      ),
    ).rejects.toThrow("session not found");
  });

  it("rejects on connect failure", async () => {
    const port = await startMockGateway((ws) => {
      const nonce = randomUUID();
      ws.send(
        JSON.stringify({
          type: "evt",
          event: "connect.challenge",
          payload: { nonce },
        }),
      );

      ws.on("message", (data) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === "req" && frame.method === "connect") {
          ws.send(
            JSON.stringify({
              type: "res",
              id: frame.id,
              ok: false,
              error: { message: "auth failed" },
            }),
          );
        }
      });
    });

    await expect(
      gatewayChatSend(
        { url: `ws://127.0.0.1:${port}` },
        {
          sessionKey: "C123",
          message: "hi",
          idempotencyKey: randomUUID(),
        },
      ),
    ).rejects.toThrow("auth failed");
  });

  it("rejects on timeout", async () => {
    const port = await startMockGateway((ws) => {
      // Send challenge but never respond to connect
      ws.send(
        JSON.stringify({
          type: "evt",
          event: "connect.challenge",
          payload: { nonce: randomUUID() },
        }),
      );
    });

    await expect(
      gatewayChatSend(
        { url: `ws://127.0.0.1:${port}`, timeoutMs: 500 },
        {
          sessionKey: "C123",
          message: "hi",
          idempotencyKey: randomUUID(),
        },
      ),
    ).rejects.toThrow("timeout");
  });

  it("passes auth token in connect params when provided", async () => {
    let capturedConnectParams: Record<string, unknown> | null = null;

    const port = await startMockGateway((ws) => {
      ws.send(
        JSON.stringify({
          type: "evt",
          event: "connect.challenge",
          payload: { nonce: randomUUID() },
        }),
      );

      ws.on("message", (data) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === "req" && frame.method === "connect") {
          capturedConnectParams = frame.params;
          // Respond ok then close to end test
          ws.send(
            JSON.stringify({
              type: "res",
              id: frame.id,
              ok: false,
              error: { message: "test-done" },
            }),
          );
        }
      });
    });

    await gatewayChatSend(
      { url: `ws://127.0.0.1:${port}`, token: "test-token" },
      {
        sessionKey: "C123",
        message: "hi",
        idempotencyKey: randomUUID(),
      },
    ).catch(() => {
      /* expected rejection */
    });

    expect(capturedConnectParams).toBeTruthy();
    expect(
      (capturedConnectParams as unknown as Record<string, unknown>).auth,
    ).toEqual({ token: "test-token" });
  });

  it("extracts text from string content", async () => {
    const port = await startMockGateway((ws) => {
      fullHandshake(ws, (runId, sock) => {
        sock.send(
          JSON.stringify({
            type: "evt",
            event: "chat",
            payload: {
              runId,
              state: "final",
              message: { content: "plain string" },
            },
          }),
        );
      });
    });

    const result = await gatewayChatSend(
      { url: `ws://127.0.0.1:${port}` },
      {
        sessionKey: "C123",
        message: "hi",
        idempotencyKey: randomUUID(),
      },
    );

    expect(result.text).toBe("plain string");
  });
});
