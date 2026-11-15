/*
 * The HTTP application for Node: src/http.ts behind an Express app.
 *
 * Express is here for one reason: the MCP SDK's OAuth endpoints (/authorize,
 * /token, /register, /revoke and the two discovery documents) are Express
 * middleware, and using them beats writing an OAuth server by hand. They
 * are mounted only when OAuth is configured. Every other request is handed
 * to src/http.ts as a standard Request, exactly as before.
 */

import express, { type Express, type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";

import { SCOPE, type CoolmathsOAuthProvider } from "./auth/oauth-provider.js";
import { handleRequest, type HttpDeps } from "./http.js";

/** Requests larger than this are refused; a JSON-RPC call is a few kB. */
const MAX_BODY_BYTES = 1_000_000;

export interface AppOptions extends Omit<HttpDeps, "oauth"> {
  /** OAuth sign-in for /mcp/me. Leave out to run without it. */
  oauth?: {
    provider: CoolmathsOAuthProvider;
    /** This server's public address, e.g. https://coolmaths-tutor.fly.dev */
    publicUrl: string;
    signInOrigins: string[];
  };
}

async function readBody(req: ExpressRequest): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** An Express request as a standard Request. Null when the body is too large. */
async function toRequest(req: ExpressRequest): Promise<Request | null> {
  const url = `${req.protocol}://${req.get("host") ?? "localhost"}${req.originalUrl}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await readBody(req) : undefined;
  if (body === null) return null;
  return new Request(url, { method: req.method, headers, body });
}

async function send(res: ExpressResponse, response: Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  // One proxy (Fly's) sits in front: take the scheme and the client's
  // address from its headers. The SDK's rate limits count per address.
  app.set("trust proxy", 1);

  const deps: HttpDeps = { authenticator: options.authenticator, store: options.store };

  if (options.oauth) {
    const { provider, publicUrl, signInOrigins } = options.oauth;
    const resource = new URL("/mcp/me", publicUrl);
    app.use(
      mcpAuthRouter({
        provider,
        issuerUrl: new URL(publicUrl),
        resourceServerUrl: resource,
        resourceName: "coolmaths tutor",
        scopesSupported: [SCOPE],
      }),
    );
    deps.authenticator = provider;
    deps.oauth = { provider, signInOrigins, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource) };
  }

  app.use(async (req, res) => {
    try {
      const request = await toRequest(req);
      if (!request) {
        res.status(413).type("text/plain").end("Request body too large.");
        return;
      }
      await send(res, await handleRequest(request, deps));
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.status(500).type("text/plain");
      res.end("Internal error.");
    }
  });

  return app;
}
