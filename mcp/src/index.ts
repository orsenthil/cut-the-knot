/*
 * Worker entry point: the MCP endpoint at /mcp.
 *
 * Stateless Streamable HTTP. Each POST builds a fresh McpServer, feeds it the
 * one JSON-RPC message in the body, and returns the reply. Nothing is kept
 * between requests, so there is no session id to track and no Durable Object
 * to pay for; see src/transport.ts for why that is the right trade here.
 *
 * The server is read-only and public, as PLAN.md B3 specifies. If that ever
 * needs to change, the place to check a bearer token is at the top of fetch().
 */

import { buildServer } from "./server.js";
import { FetchServerTransport } from "./transport.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

/** A JSON-RPC error with no request to attach it to. */
const rpcError = (code: number, message: string, status: number, id: unknown = null) =>
  jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, status);

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // A human or a health check landing on the root.
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(
        [
          "coolmaths tutor — an MCP server for https://orsenthil.github.io/cut-the-knot/",
          "",
          `Endpoint: ${url.origin}/mcp  (Streamable HTTP, stateless, no auth)`,
          "",
          "Claude Code:",
          `  claude mcp add --transport http coolmaths ${url.origin}/mcp`,
          "",
          "claude.ai / Desktop: Settings -> Connectors -> add a custom connector with that URL.",
          "",
          "Source: https://github.com/orsenthil/cut-the-knot/tree/web/mcp",
        ].join("\n"),
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8", ...CORS } },
      );
    }

    if (url.pathname !== "/mcp") {
      return rpcError(-32601, `Not found. The MCP endpoint is ${url.origin}/mcp`, 404);
    }

    // This server has nothing to push, so there is no SSE stream to open.
    if (request.method === "GET") {
      return rpcError(-32000, "This server is stateless and opens no SSE stream. POST JSON-RPC to /mcp.", 405);
    }

    // No sessions to end, but a client is entitled to try.
    if (request.method === "DELETE") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return rpcError(-32600, `${request.method} is not supported on /mcp.`, 405);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return rpcError(-32700, "Parse error: the body is not valid JSON.", 400);
    }

    const server = buildServer();
    const transport = new FetchServerTransport();

    try {
      await server.connect(transport);
      const replies = await transport.handle(payload);

      // Notifications and responses get no body of their own.
      if (replies.length === 0) {
        return new Response(null, { status: 202, headers: CORS });
      }
      return jsonResponse(Array.isArray(payload) ? replies : replies[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const id =
        !Array.isArray(payload) && payload && typeof payload === "object" && "id" in payload
          ? (payload as { id: unknown }).id
          : null;
      return rpcError(-32603, `Internal error: ${message}`, 500, id);
    } finally {
      await server.close().catch(() => {});
    }
  },
};
