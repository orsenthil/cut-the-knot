/*
 * The server's HTTP surface, written against the standard Request and
 * Response objects.
 *
 *   GET  /          a plain-text note for a person or a health check
 *   POST /mcp       the public endpoint: no sign-in
 *   POST /mcp/me    the same server plus the personal tools: needs sign-in
 *
 * Request and Response exist in Node, Workers, Deno and Bun alike, so this
 * file is the same on any of them; src/node.ts is the only Node-specific
 * part. Both endpoints speak stateless Streamable HTTP: one POST carries one
 * JSON-RPC message or a batch, and the replies come back in the body. There
 * is no SSE stream and no session, so GET is 405 and DELETE is a no-op.
 */

import type { Authenticator } from "./auth/authenticator.js";
import { handle } from "./core/handle.js";
import type { UserStore } from "./core/store.js";
import type { ServerContext } from "./server/build.js";

export interface HttpDeps {
  /** Sign-in for /mcp/me. Without it, or without a store, /mcp/me answers 503. */
  authenticator?: Authenticator;
  store?: UserStore;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

const SOURCE = "https://github.com/orsenthil/cut-the-knot/tree/web/mcp";

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...headers },
  });

/** A JSON-RPC error, for failures that have no request to attach to. */
const rpcError = (code: number, message: string, status: number, id: unknown = null, headers = {}) =>
  jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, status, headers);

function landingPage(origin: string, personal: boolean): Response {
  const text = [
    "coolmaths tutor — an MCP server for https://orsenthil.github.io/cut-the-knot/",
    "",
    `Endpoint: ${origin}/mcp  (Streamable HTTP, stateless, no sign-in)`,
    personal ? `Signed in: ${origin}/mcp/me  (the same, plus your own progress and position)` : "",
    "",
    "Claude Code:",
    `  claude mcp add --transport http coolmaths ${origin}/mcp`,
    "",
    "claude.ai / Desktop: Settings -> Connectors -> add a custom connector with that URL.",
    "",
    `Source: ${SOURCE}`,
  ];
  return new Response(text.join("\n"), { status: 200, headers: { "content-type": "text/plain; charset=utf-8", ...CORS } });
}

/** Runs one POSTed payload through the MCP server. */
async function serveMcp(request: Request, context: ServerContext): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rpcError(-32700, "Parse error: the body is not valid JSON.", 400);
  }

  try {
    const replies = await handle(payload, context);
    // Notifications and responses get no body of their own.
    if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });
    return jsonResponse(Array.isArray(payload) ? replies : replies[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const id =
      !Array.isArray(payload) && payload && typeof payload === "object" && "id" in payload
        ? (payload as { id: unknown }).id
        : null;
    return rpcError(-32603, `Internal error: ${message}`, 500, id);
  }
}

export async function handleRequest(request: Request, deps: HttpDeps = {}): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const personalReady = Boolean(deps.authenticator && deps.store);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (path === "/") return landingPage(url.origin, personalReady);

  if (path !== "/mcp" && path !== "/mcp/me") {
    return rpcError(-32601, `Not found. The MCP endpoint is ${url.origin}/mcp`, 404);
  }

  // This server has nothing to push, so there is no SSE stream to open.
  if (request.method === "GET") {
    return rpcError(-32000, `This server is stateless and opens no SSE stream. POST JSON-RPC to ${path}.`, 405);
  }
  // No sessions to end, but a client is entitled to try.
  if (request.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return rpcError(-32600, `${request.method} is not supported on ${path}.`, 405);

  if (path === "/mcp") return serveMcp(request, {});

  if (!deps.authenticator || !deps.store) {
    return rpcError(-32000, "Signing in is not set up on this server yet. The public endpoint is /mcp.", 503);
  }
  const user = await deps.authenticator.authenticate(request.headers.get("authorization"));
  if (!user) {
    return rpcError(-32001, "Sign in to use this endpoint.", 401, null, { "WWW-Authenticate": 'Bearer realm="coolmaths"' });
  }
  return serveMcp(request, { user, store: deps.store });
}
