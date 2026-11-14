/*
 * The whole MCP server as one function: a parsed JSON-RPC payload in, the
 * replies out.
 *
 * Nothing here knows about HTTP, Node, or any hosting platform, which is what
 * keeps the server portable: src/node.ts wraps this in an HTTP listener for
 * Fly.io, test/golden.mjs calls it directly, and a Worker or a Lambda would
 * need only their own few lines around it.
 *
 * It is stateless. Each call builds a fresh McpServer, so no initialize
 * handshake is required first, nothing is kept between requests, and any
 * number of machines can serve the same URL. The price is that the server
 * cannot push notifications; it has none to push.
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { buildServer, type ServerContext } from "../server/build.js";

/** How long a single payload may take before the request fails. */
const DEADLINE_MS = 25_000;

/** Collects what the server sends while one payload is handled. */
class CollectingTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  readonly sent: JSONRPCMessage[] = [];

  async start(): Promise<void> {
    /* nothing to open: the payload is already here */
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}

const isRequest = (m: JSONRPCMessage) => "method" in m && "id" in m && m.id !== undefined;

/**
 * Feeds one payload (a message or a batch) to a fresh server and returns the
 * replies. Notifications get no reply, so an all-notification payload returns
 * an empty array; over HTTP that becomes 202 Accepted.
 */
export async function handle(payload: unknown, context: ServerContext = {}): Promise<JSONRPCMessage[]> {
  const messages = (Array.isArray(payload) ? payload : [payload]) as JSONRPCMessage[];
  const expected = messages.filter(isRequest).length;

  const server = buildServer(context);
  const transport = new CollectingTransport();
  await server.connect(transport);

  try {
    for (const message of messages) transport.onmessage?.(message);

    // Handlers are async. Wait until every request is answered, but not
    // forever: a handler that never settles fails the request.
    const deadline = Date.now() + DEADLINE_MS;
    while (transport.sent.length < expected && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    return transport.sent;
  } finally {
    await server.close().catch(() => {});
  }
}
