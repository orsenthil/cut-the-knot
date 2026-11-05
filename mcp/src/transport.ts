/*
 * A stateless Streamable HTTP transport for Cloudflare Workers.
 *
 * The SDK ships StreamableHTTPServerTransport, but it is written against
 * node:http request and response objects, which a Worker does not have. This
 * is the same protocol over the Fetch API instead: one POST carries one
 * JSON-RPC message (or a batch), the server answers in the body, and nothing
 * is kept between requests.
 *
 * Stateless is the right shape here. The tutor only reads baked-in content, so
 * there is no per-session state worth keeping, and avoiding sessions means
 * avoiding Durable Objects: the Worker stays on the free tier and any number
 * of isolates can serve the same URL.
 *
 * Consequences of having no stream, all of them fine for this server:
 *   - GET /mcp (the server-to-client SSE channel) is not offered, so the
 *     server never pushes notifications. It has none to push.
 *   - DELETE /mcp (end session) is a no-op.
 *   - Each request builds a fresh McpServer and connects it, so an initialize
 *     is not required first.
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class FetchServerTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: unknown) => void;

  /** Replies the server produced while handling the current request. */
  private outgoing: JSONRPCMessage[] = [];
  private closed = false;

  async start(): Promise<void> {
    /* nothing to open: the HTTP request is already here */
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.outgoing.push(message);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  /**
   * Feeds one parsed JSON-RPC payload to the server and collects the replies.
   *
   * Requests are matched to replies by id. A notification has no id and gets no
   * reply, which is why an all-notification payload resolves to an empty array:
   * the caller turns that into 202 Accepted.
   */
  async handle(payload: unknown): Promise<JSONRPCMessage[]> {
    const messages: JSONRPCMessage[] = Array.isArray(payload)
      ? (payload as JSONRPCMessage[])
      : [payload as JSONRPCMessage];

    const expected = messages.filter((m) => "id" in m && m.id !== undefined && "method" in m).length;
    this.outgoing = [];

    for (const message of messages) {
      this.onmessage?.(message);
    }

    // The handlers are async; wait until every request has been answered.
    // A short bounded wait rather than an open-ended one, so a handler that
    // never settles fails the request instead of hanging the isolate.
    const deadline = Date.now() + 25_000;
    while (this.outgoing.length < expected && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5));
    }

    return this.outgoing;
  }
}
