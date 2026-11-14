/*
 * The HTTP surface (src/http.ts), in-process: no port, no network.
 *
 *   npm test        (or: npx tsx test/http.test.mjs)
 *
 * Checks the routes and status codes, that /mcp/me is closed without sign-in
 * and refuses a wrong token, and that the personal tools see only the
 * signed-in player and respect their "no access" setting.
 */

import { handleRequest } from "../src/http.ts";
import { handle } from "../src/core/handle.ts";
import { DevAuthenticator } from "../src/auth/dev.ts";
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

const TOKEN = "a-long-enough-dev-token";
const store = new MemoryStore(fixtures);
const signedIn = { authenticator: new DevAuthenticator(TOKEN, "ada"), store };

const rpc = (method, params) => JSON.stringify({ jsonrpc: "2.0", id: 7, method, params });
const post = (path, body, headers = {}) =>
  new Request(`https://tutor.example${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
const toolNames = async (response) => (await response.json()).result.tools.map((t) => t.name);

/* ------------------------------------------------------------------ routes */

let res = await handleRequest(new Request("https://tutor.example/"));
check("GET / is a text page", res.status === 200 && (await res.text()).includes("https://tutor.example/mcp"));

res = await handleRequest(new Request("https://tutor.example/nowhere"));
check("an unknown path is 404", res.status === 404);

res = await handleRequest(new Request("https://tutor.example/mcp"));
check("GET /mcp is 405: there is no stream", res.status === 405);

res = await handleRequest(new Request("https://tutor.example/mcp", { method: "DELETE" }));
check("DELETE /mcp is a no-op", res.status === 204);

res = await handleRequest(new Request("https://tutor.example/mcp", { method: "OPTIONS" }));
check("OPTIONS answers CORS", res.status === 204 && res.headers.get("access-control-allow-origin") === "*");

res = await handleRequest(post("/mcp", "{not json"));
check("bad JSON is 400", res.status === 400 && (await res.json()).error.code === -32700);

res = await handleRequest(post("/mcp", JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })));
check("a notification is 202 with no body", res.status === 202 && (await res.text()) === "");

res = await handleRequest(post("/mcp", JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "tools/list" }, { jsonrpc: "2.0", id: 2, method: "prompts/list" }])));
const batch = await res.json();
check("a batch gets an array back", Array.isArray(batch) && batch.length === 2);

/* ------------------------------------------------------------ public /mcp */

res = await handleRequest(post("/mcp", rpc("tools/list")));
const publicTools = await toolNames(res);
check("/mcp has the public tools", publicTools.includes("run_game_logic"));
check("/mcp has no personal tools", !publicTools.some((n) => n.startsWith("my_") || n === "whoami"), publicTools.join(","));

res = await handleRequest(post("/mcp", rpc("tools/list"), { authorization: `Bearer ${TOKEN}` }), signedIn);
check("/mcp stays public even with a token", !(await toolNames(res)).includes("my_position"));

res = await handleRequest(post("/mcp", rpc("tools/call", { name: "run_game_logic", arguments: { slug: "hourglass", action: "solve", args: { a: 7, b: 11, target: 15 } } })));
const solved = JSON.parse((await res.json()).result.content[0].text);
check("the 7 and 11 minute glasses boil a 15 minute egg in 3 flips", solved.flips === 3, JSON.stringify(solved.flips));

/* -------------------------------------------------------------- /mcp/me */

res = await handleRequest(post("/mcp/me", rpc("tools/list")));
check("/mcp/me is 503 when sign-in is not set up", res.status === 503);

res = await handleRequest(post("/mcp/me", rpc("tools/list")), signedIn);
check("/mcp/me without a token is 401", res.status === 401 && res.headers.get("www-authenticate")?.startsWith("Bearer"));

for (const bad of ["Bearer wrong-token-of-similar-len", "Bearer ", "Basic abc", `Bearer ${TOKEN}x`, TOKEN]) {
  res = await handleRequest(post("/mcp/me", rpc("tools/list"), { authorization: bad }), signedIn);
  check(`/mcp/me refuses "${bad.slice(0, 14)}..."`, res.status === 401);
}

res = await handleRequest(post("/mcp/me", rpc("tools/list"), { authorization: `Bearer ${TOKEN}` }), signedIn);
const personalTools = await toolNames(res);
check("/mcp/me has the personal tools", ["whoami", "my_progress", "recommend_next", "my_position"].every((n) => personalTools.includes(n)));
check("/mcp/me keeps the public tools", publicTools.every((n) => personalTools.includes(n)));

res = await handleRequest(post("/mcp/me/", rpc("tools/call", { name: "my_position", arguments: {} }), { authorization: `Bearer ${TOKEN}` }), signedIn);
const position = JSON.parse((await res.json()).result.content[0].text);
check("my_position is the player's own game", position.playing && position.game.slug === "coins");
check("my_position carries the core's analysis", position.analysis.yourChoices.length === 2);

/* ------------------------------------------- one player never sees another */

const text = (reply) => reply.result.content[0].text;
const callAs = async (uid, name, args = {}) =>
  (await handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, { user: { uid }, store }))[0];

const sam = JSON.parse(text(await callAs("new-player", "my_progress")));
check("a new player has played nothing", sam.gamesPlayed === 0);
check("a new player has no position", JSON.parse(text(await callAs("new-player", "my_position"))).playing === false);
const first = JSON.parse(text(await callAs("new-player", "recommend_next", { count: 1 })));
check("a new player is given a starting point", first.length === 1 && first[0].reason === "A good place to start.");

const ada = JSON.parse(text(await callAs("ada", "my_progress")));
check("ada sees her three games", ada.gamesPlayed === 3 && ada.played[0].slug === "coins");
check("nothing of ada's leaks to a stranger", JSON.parse(text(await callAs("nobody", "my_progress"))).gamesPlayed === 0);

for (const tool of ["whoami", "my_progress", "recommend_next", "my_position"]) {
  const reply = await callAs("private", tool);
  check(`${tool} respects "access off"`, reply.result.isError === true && /turned off/.test(text(reply)));
}

/* ----------------------------------------------- a bad position is survivable */

const broken = new MemoryStore({ x: { live: { slug: "coins", sessionId: "s", stateVersion: 1, state: { nonsense: true }, status: "", updatedAt: 0 } } });
const reply = JSON.parse(text((await handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "my_position", arguments: {} } }, { user: { uid: "x" }, store: broken }))[0]));
check("an unreadable position still answers", reply.playing === true && reply.analysis === null && typeof reply.analysisError === "string");

if (failures) {
  console.error(`FAIL http: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok   http (${checks} checks)`);
