/*
 * The Node entry point: an HTTP listener around src/http.ts.
 *
 * This is what runs on Fly.io (see Dockerfile and fly.toml), and what
 * `npm run dev` runs locally. Everything that matters is in src/http.ts,
 * which is platform-free; this file only turns Node's request and response
 * objects into the standard ones and back, and reads the environment.
 *
 * Environment:
 *   PORT                   port to listen on (default 8080)
 *   COOLMATHS_DEV_TOKEN    } set both, for local work only, to switch on
 *   COOLMATHS_DEV_USER     } /mcp/me with a fixed token and the fixture players
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { DevAuthenticator } from "./auth/dev.js";
import { handleRequest, type HttpDeps } from "./http.js";
import { MemoryStore } from "./stores/memory.js";
import fixtures from "../fixtures/users.json";

/** Requests larger than this are refused; a JSON-RPC call is a few kB. */
const MAX_BODY_BYTES = 1_000_000;

function depsFromEnv(env: NodeJS.ProcessEnv): HttpDeps {
  const { COOLMATHS_DEV_TOKEN: token, COOLMATHS_DEV_USER: uid } = env;
  if (token && uid) {
    console.warn(`dev sign-in is ON: /mcp/me serves fixture player "${uid}". Never do this in production.`);
    return { authenticator: new DevAuthenticator(token, uid), store: new MemoryStore(fixtures) };
  }
  return {};
}

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function toRequest(req: IncomingMessage): Promise<Request | null> {
  // Behind Fly's proxy the original scheme and host arrive in these headers.
  const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0];
  const url = `${proto}://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await readBody(req) : undefined;
  if (body === null) return null;
  return new Request(url, { method: req.method, headers, body });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const deps = depsFromEnv(process.env);

const server = createServer(async (req, res) => {
  try {
    const request = await toRequest(req);
    if (!request) {
      res.writeHead(413, { "content-type": "text/plain" }).end("Request body too large.");
      return;
    }
    await send(res, await handleRequest(request, deps));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal error.");
  }
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => console.log(`coolmaths tutor listening on :${port}`));

// Fly stops idle machines with SIGINT; finish what is in flight and leave.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
