/*
 * OAuth sign-in for /mcp/me, end to end over real HTTP on a local port,
 * with an in-memory store and a stand-in for Firebase's ID-token check.
 *
 *   npm test        (or: npx tsx test/oauth.test.mjs)
 *
 * It walks the path a client such as claude.ai takes: discover, register,
 * authorize, the player allows, swap the code for tokens, call a personal
 * tool, refresh, revoke. Then it tries the ways that must fail.
 */

import { createHash, randomBytes } from "node:crypto";

import { createApp } from "../src/app.ts";
import { CoolmathsOAuthProvider } from "../src/auth/oauth-provider.ts";
import { MemoryOAuthStore } from "../src/auth/oauth-store.ts";
import { MemoryStore } from "../src/stores/memory.ts";
import fixtures from "../fixtures/users.json" with { type: "json" };

let failures = 0;
let checks = 0;
function check(label, ok, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

const SITE = "https://site.example";
const SIGN_IN_URL = `${SITE}/signin/`;
const REDIRECT = "https://client.example/callback";

let clock = Date.UTC(2026, 10, 14, 12, 0, 0);
const oauthStore = new MemoryOAuthStore(() => clock);
const provider = new CoolmathsOAuthProvider({
  store: oauthStore,
  signInUrl: SIGN_IN_URL,
  now: () => clock,
  // Stands in for Firebase: "id-token-for-<uid>" is that player; anything else is refused.
  verifyIdToken: async (token) => {
    const match = /^id-token-for-([\w-]+)$/.exec(token);
    if (!match) throw new Error("bad token");
    return match[1];
  },
});

const server = createApp({ store: new MemoryStore(fixtures), oauth: { provider, publicUrl: "http://localhost:0", signInOrigins: [SITE] } }).listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const form = (fields) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
const fromSite = (init = {}) => ({ ...init, headers: { ...(init.headers || {}), origin: SITE } });
const rpc = (name) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } });
const callTool = (path, name, token) =>
  fetch(`${base}${path}`, { ...json(rpc(name)), headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) } });

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function register(extra = {}) {
  const res = await fetch(`${base}/register`, json({ client_name: "Test Client", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", ...extra }));
  return { status: res.status, body: await res.json() };
}

/** /authorize, returning the id of the request the sign-in page is sent. */
async function authorize(clientId, challenge, state = "xyz") {
  const url = new URL(`${base}/authorize`);
  url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state }).toString();
  const res = await fetch(url, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  return { status: res.status, location, request: location.startsWith(SIGN_IN_URL) ? new URL(location).searchParams.get("request") : null };
}

async function complete(request, uid, allow = true) {
  const res = await fetch(`${base}/oauth/complete`, fromSite(json({ request, idToken: uid ? `id-token-for-${uid}` : "garbage", allow })));
  return { status: res.status, body: await res.json() };
}

const token = (fields) => fetch(`${base}/token`, form(fields)).then(async (res) => ({ status: res.status, body: await res.json() }));

/** The whole sign-in for one player; returns the client and its tokens. */
async function signIn(uid) {
  const { body: client } = await register();
  const { verifier, challenge } = pkce();
  const { request } = await authorize(client.client_id, challenge);
  const { body } = await complete(request, uid);
  const code = new URL(body.redirect).searchParams.get("code");
  const tokens = await token({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier, redirect_uri: REDIRECT });
  return { client, tokens: tokens.body, code, verifier };
}

/* ---------------------------------------------------------------- discovery */

let res = await callTool("/mcp/me", "whoami");
const challengeHeader = res.headers.get("www-authenticate") || "";
check("/mcp/me without a token is 401", res.status === 401);
check("the 401 says where to find the sign-in details", /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/mcp\/me"/.test(challengeHeader), challengeHeader);

const resourceMeta = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp/me`)).json();
check("the resource names its authorization server", Array.isArray(resourceMeta.authorization_servers) && resourceMeta.resource.endsWith("/mcp/me"), JSON.stringify(resourceMeta));

const serverMeta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
check("the server advertises PKCE with S256 only", JSON.stringify(serverMeta.code_challenge_methods_supported) === '["S256"]');
check("the server advertises registration and revocation", Boolean(serverMeta.registration_endpoint && serverMeta.revocation_endpoint));

/* ------------------------------------------------------------- registration */

const registered = await register();
check("a client can register", registered.status === 201 && typeof registered.body.client_id === "string", JSON.stringify(registered.body));
check("an http redirect on another host is refused", (await register({ redirect_uris: ["http://evil.example/cb"] })).status >= 400);
check("six redirect URIs are refused", (await register({ redirect_uris: Array.from({ length: 6 }, (_, i) => `https://c.example/${i}`) })).status >= 400);
check("localhost over http is allowed", (await register({ redirect_uris: ["http://localhost:9999/cb"] })).status === 201);
check("oversized metadata is refused", (await register({ client_name: "x".repeat(5000) })).status >= 400);

/* ---------------------------------------------------------- the happy path */

const clientId = registered.body.client_id;
const { verifier, challenge } = pkce();
const started = await authorize(clientId, challenge, "state-123");
check("/authorize sends the browser to the site's sign-in page", started.status === 302 && started.request !== null, started.location);

res = await fetch(`${base}/oauth/request/${started.request}`, fromSite());
const described = await res.json();
check("the sign-in page can see who is asking", res.status === 200 && described.clientName === "Test Client" && described.redirectHost === "client.example", JSON.stringify(described));
check("only for the site's origin", res.headers.get("access-control-allow-origin") === SITE);

const done = await complete(started.request, "ada");
const back = new URL(done.body.redirect);
check("allowing sends the browser back to the client with a code", done.status === 200 && back.origin + back.pathname === REDIRECT && back.searchParams.has("code"));
check("the client's state comes back unchanged", back.searchParams.get("state") === "state-123");
const code = back.searchParams.get("code");

const granted = await token({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: REDIRECT });
check("the code buys tokens", granted.status === 200 && granted.body.token_type === "Bearer" && granted.body.expires_in === 3600 && Boolean(granted.body.refresh_token), JSON.stringify(granted.body));

res = await callTool("/mcp/me", "my_position", granted.body.access_token);
const position = JSON.parse((await res.json()).result.content[0].text);
check("the token reaches the player's own position", res.status === 200 && position.game.slug === "coins");

res = await callTool("/mcp", "whoami", granted.body.access_token);
const onPublic = await res.json();
check("/mcp has no personal tools even with a token", Boolean(onPublic.error) || onPublic.result?.isError === true, JSON.stringify(onPublic).slice(0, 200));

/* --------------------------------------------- nothing is stored in the clear */

const stored = JSON.stringify([...oauthStore.items.entries()]);
check("no code or token is stored as itself", ![code, granted.body.access_token, granted.body.refresh_token].some((secret) => stored.includes(secret)));

/* ------------------------------------------------------------ refresh, revoke */

const refreshed = await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: granted.body.refresh_token });
check("a refresh token buys new tokens", refreshed.status === 200 && refreshed.body.access_token !== granted.body.access_token);
check("a refresh token works once", (await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: granted.body.refresh_token })).status === 400);

res = await fetch(`${base}/revoke`, form({ client_id: clientId, token: refreshed.body.access_token }));
check("a token can be revoked", res.status === 200);
check("and then no longer works", (await callTool("/mcp/me", "whoami", refreshed.body.access_token)).status === 401);

/* -------------------------------------------------------------- expiry */

const session = await signIn("ada");
check("a fresh token works", (await callTool("/mcp/me", "whoami", session.tokens.access_token)).status === 200);
clock += 61 * 60_000;
check("an access token stops after an hour", (await callTool("/mcp/me", "whoami", session.tokens.access_token)).status === 401);
check("the refresh token still works then", (await token({ grant_type: "refresh_token", client_id: session.client.client_id, refresh_token: session.tokens.refresh_token })).status === 200);

{
  const { body: client } = await register();
  const p = pkce();
  const a = await authorize(client.client_id, p.challenge);
  clock += 11 * 60_000;
  check("a sign-in left for 11 minutes has expired", (await complete(a.request, "ada")).status === 404);

  const b = await authorize(client.client_id, p.challenge);
  const c = new URL((await complete(b.request, "ada")).body.redirect).searchParams.get("code");
  clock += 6 * 60_000;
  check("a code left for 6 minutes has expired", (await token({ grant_type: "authorization_code", client_id: client.client_id, code: c, code_verifier: p.verifier })).status === 400);
}

/* --------------------------------------------------- the ways it must fail */

check("a code works once", (await token({ grant_type: "authorization_code", client_id: session.client.client_id, code: session.code, code_verifier: session.verifier })).status === 400);

{
  const { body: client } = await register();
  const p = pkce();
  const a = await authorize(client.client_id, p.challenge);
  const c = new URL((await complete(a.request, "ada")).body.redirect).searchParams.get("code");
  const wrong = await token({ grant_type: "authorization_code", client_id: client.client_id, code: c, code_verifier: pkce().verifier });
  check("the wrong PKCE verifier is refused", wrong.status === 400, JSON.stringify(wrong.body));
}

{
  const { body: thief } = await register();
  const { body: client } = await register();
  const p = pkce();
  const a = await authorize(client.client_id, p.challenge);
  const c = new URL((await complete(a.request, "ada")).body.redirect).searchParams.get("code");
  check("another client cannot spend the code", (await token({ grant_type: "authorization_code", client_id: thief.client_id, code: c, code_verifier: p.verifier })).status === 400);

  const mine = await signIn("ada");
  check("another client cannot spend the refresh token", (await token({ grant_type: "refresh_token", client_id: thief.client_id, refresh_token: mine.tokens.refresh_token })).status === 400);
  await fetch(`${base}/revoke`, form({ client_id: thief.client_id, token: mine.tokens.access_token }));
  check("another client cannot revoke the token", (await callTool("/mcp/me", "whoami", mine.tokens.access_token)).status === 200);
}

{
  const url = new URL(`${base}/authorize`);
  url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: "https://evil.example/cb", code_challenge: challenge, code_challenge_method: "S256" }).toString();
  res = await fetch(url, { redirect: "manual" });
  check("an unregistered redirect_uri is refused, not redirected to", res.status === 400);

  url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT }).toString();
  res = await fetch(url, { redirect: "manual" });
  check("/authorize without PKCE never reaches sign-in", !(res.headers.get("location") || "").startsWith(SIGN_IN_URL));
}

{
  const a = await authorize(clientId, challenge);
  const bad = await complete(a.request, null);
  check("an ID token that does not verify is refused", bad.status === 400 && !("redirect" in bad.body));
  const retry = await complete(a.request, "ada");
  check("and does not use up the sign-in", retry.status === 200);
  check("a finished sign-in cannot be finished again", (await complete(a.request, "ada")).status === 404);

  const b = await authorize(clientId, challenge, "s2");
  const denied = new URL((await complete(b.request, "ada", false)).body.redirect);
  check("refusing sends access_denied and no code", denied.searchParams.get("error") === "access_denied" && !denied.searchParams.has("code") && denied.searchParams.get("state") === "s2");

  check("an unknown sign-in is 404", (await fetch(`${base}/oauth/request/${"a".repeat(43)}`, fromSite())).status === 404);
}

{
  const a = await authorize(clientId, challenge);
  res = await fetch(`${base}/oauth/complete`, { ...json({ request: a.request, idToken: "id-token-for-ada", allow: true }), headers: { "content-type": "application/json", origin: "https://evil.example" } });
  check("another site cannot finish a sign-in", res.status === 403);
  res = await fetch(`${base}/oauth/complete`, json({ request: a.request, idToken: "id-token-for-ada", allow: true }));
  check("nor can a call with no origin", res.status === 403);
  check("nor read who is asking", (await fetch(`${base}/oauth/request/${a.request}`, { headers: { origin: "https://evil.example" } })).status === 403);
  check("the sign-in is still there for the real page", (await complete(a.request, "ada")).status === 200);
}

for (const bad of ["", "not-a-token", session.tokens.refresh_token, session.code]) {
  check(`/mcp/me refuses "${String(bad).slice(0, 12)}" as an access token`, (await callTool("/mcp/me", "whoami", bad)).status === 401);
}

/* ----------------------------------------------------- one player, one record */

const sam = await signIn("new-player");
res = await callTool("/mcp/me", "my_progress", sam.tokens.access_token);
check("each token sees only its own player", JSON.parse((await res.json()).result.content[0].text).gamesPlayed === 0);

const kit = await signIn("private");
res = await callTool("/mcp/me", "my_progress", kit.tokens.access_token);
check("a player who switched access off is refused even with a token", (await res.json()).result.isError === true);

server.close();
if (failures) {
  console.error(`FAIL oauth: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok   oauth (${checks} checks)`);
