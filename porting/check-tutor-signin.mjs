#!/usr/bin/env node
"use strict";

/*
 * Signing the tutor in to a player's account, end to end, against the
 * Firebase emulators (never the real project):
 *
 *   cd firebase && npm run test:tutor
 *
 * Everything real is in the loop: the MCP server (mcp/src/node.ts) started
 * in emulator mode, the site's sign-in page (signin/) in a browser, the
 * Firestore backend the page writes with and the Firestore store the server
 * reads with. This file plays the part of the MCP client, such as claude.ai.
 *
 * A player plays coins while signed in, the client asks to connect, the
 * player allows it, and the client must then see that player's coins
 * position through /mcp/me. Cancelling, and switching the tutor's access
 * off on the profile, must both shut it out.
 */

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { serveRepo, launch, REPO } from "./lib/browser.mjs";

const shots = process.argv[2] || null;
// Where the emulators are: `firebase emulators:exec` says, in these variables
// (the ports are set in firebase/firebase.json).
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8685";
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9199";
const [FIRESTORE_HOST, FIRESTORE_PORT] = [FIRESTORE.split(":")[0], Number(FIRESTORE.split(":")[1])];
const TUTOR_PORT = 8799;
const TUTOR = `http://127.0.0.1:${TUTOR_PORT}`;
const CALLBACK = "http://localhost:9911/callback";
const ADA = { sub: "ada-9", email: "ada9@example.com", name: "Ada L." };

const { server, port } = await serveRepo();
const site = `http://127.0.0.1:${port}`;
let failed = false;

function check(label, ok, detail = "") {
  if (ok) console.log(`ok   ${label}`);
  else {
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
    failed = true;
  }
}

/* ---- the tutor's server, in emulator mode ---- */

const tutor = spawn("npx", ["tsx", "src/node.ts"], {
  cwd: join(REPO, "mcp"),
  env: {
    ...process.env,
    PORT: String(TUTOR_PORT),
    FIRESTORE_EMULATOR_HOST: FIRESTORE,
    FIREBASE_AUTH_EMULATOR_HOST: AUTH,
    FIREBASE_PROJECT_ID: "demo-coolmaths",
    PUBLIC_URL: `http://localhost:${TUTOR_PORT}`,
    SIGN_IN_URL: `${site}/signin/`,
    SIGN_IN_ORIGINS: site,
    FIREBASE_SERVICE_ACCOUNT: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let tutorLog = "";
tutor.stdout.on("data", (d) => (tutorLog += d));
tutor.stderr.on("data", (d) => (tutorLog += d));

async function waitForTutor() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${TUTOR}/`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`the tutor's server did not start:\n${tutorLog}`);
}

/* ---- the client's side of OAuth ---- */

const post = (path, body, headers = {}) => fetch(`${TUTOR}${path}`, { method: "POST", headers, body });
const jsonHeaders = { "content-type": "application/json" };
const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

async function callTool(name, accessToken) {
  const res = await post("/mcp/me", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } }), {
    ...jsonHeaders,
    authorization: `Bearer ${accessToken}`,
  });
  if (res.status !== 200) return { status: res.status };
  const result = (await res.json()).result;
  return { status: 200, isError: result.isError === true, text: result.content[0].text };
}

function authorizeUrl(clientId, challenge, state) {
  const url = new URL(`${TUTOR}/authorize`);
  url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: CALLBACK, code_challenge: challenge, code_challenge_method: "S256", state }).toString();
  return url.href;
}

const browser = await launch();
try {
  await waitForTutor();

  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  await context.addInitScript(
    (emulators) => {
      window.COOLMATHS_EMULATORS = emulators;
    },
    { projectId: "demo-coolmaths", auth: `http://${AUTH}`, firestoreHost: FIRESTORE_HOST, firestorePort: FIRESTORE_PORT, tutorServer: TUTOR },
  );
  // The client's callback address does not exist; answer it so the browser lands somewhere.
  await context.route("http://localhost:9911/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>client</title>back at the client" }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  /* ---- a signed-in player in the middle of a game of coins ---- */

  await page.goto(`${site}/profile/`);
  await page.waitForFunction(() => window.COOLMATHS_AUTH);
  await page.evaluate((who) => COOLMATHS_AUTH.signInForTest(who), ADA);
  await page.waitForFunction(() => Track.backend().name === "firebase");

  await page.goto(`${site}/coins/`);
  await page.waitForFunction(() => window.COOLMATHS_AUTH && Track.backend().name === "firebase");
  await page.locator(".coin.end").first().click();
  await page.waitForFunction(() => !busy);
  await page.evaluate(() => Track.flush());
  const onScreen = await page.evaluate(() => game.snapshot());

  /* ---- the client registers and asks to connect ---- */

  const registration = await post("/register", JSON.stringify({ client_name: "Claude (test)", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none" }), jsonHeaders);
  const client = await registration.json();
  check("the client registers", registration.status === 201 && typeof client.client_id === "string", JSON.stringify(client));
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  // Cancelling first.
  await page.goto(authorizeUrl(client.client_id, challenge, "cancel-1"));
  await page.waitForSelector("#decide:not([hidden])");
  check("the sign-in page names who is asking", (await page.textContent("#clientName")) === "Claude (test)" && (await page.textContent("#redirectHost")) === "localhost:9911");
  check("and who is signed in", (await page.textContent("#who")) === ADA.name);
  check("no sideways scrolling at 375px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (shots) await page.screenshot({ path: join(shots, "tutor-consent.png") });
  await Promise.all([page.waitForURL(/localhost:9911/), page.click("#cancel")]);
  let back = new URL(page.url());
  check("cancel: the client is told access was denied", back.searchParams.get("error") === "access_denied" && !back.searchParams.has("code") && back.searchParams.get("state") === "cancel-1");

  // Then allowing.
  await page.goto(authorizeUrl(client.client_id, challenge, "allow-1"));
  await page.waitForSelector("#decide:not([hidden])");
  await Promise.all([page.waitForURL(/localhost:9911/), page.click("#allow")]);
  back = new URL(page.url());
  const code = back.searchParams.get("code");
  check("allow: the client gets a code and its state back", Boolean(code) && back.searchParams.get("state") === "allow-1");

  const tokens = await (
    await post("/token", new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier, redirect_uri: CALLBACK }), formHeaders)
  ).json();
  check("the code buys an access token", typeof tokens.access_token === "string", JSON.stringify(tokens));

  /* ---- the client sees this player's game ---- */

  const who = await callTool("whoami", tokens.access_token);
  check("whoami: the player's name", who.status === 200 && JSON.parse(who.text).displayName === ADA.name, who.text);

  const position = await callTool("my_position", tokens.access_token);
  const seen = JSON.parse(position.text);
  check("my_position: the game is coins", seen.playing === true && seen.game.slug === "coins", position.text.slice(0, 200));
  check("my_position: the coins are the ones on the player's screen", JSON.stringify(seen.state.values) === JSON.stringify(onScreen.values) && JSON.stringify(seen.state.left) === JSON.stringify(onScreen.left));
  check("my_position: the game's own code describes the position", seen.analysis && Array.isArray(seen.analysis.yourChoices) && seen.analysis.yourChoices.length >= 1);

  const progress = JSON.parse((await callTool("my_progress", tokens.access_token)).text);
  check("my_progress: coins is in the record", progress.played.some((g) => g.slug === "coins"));

  /* ---- a page opened with no request, or a made-up one ---- */

  await page.goto(`${site}/signin/`);
  await page.waitForSelector("#problem:not([hidden])");
  check("the page explains itself when opened on its own", /nothing to do here/.test(await page.textContent("#problemText")));
  await page.goto(`${site}/signin/?request=${"z".repeat(43)}`);
  await page.waitForSelector("#problem:not([hidden])");
  check("a made-up request is reported as expired", /expired/.test(await page.textContent("#problemText")));

  /* ---- the player switches the tutor off ---- */

  await page.goto(`${site}/profile/`);
  await page.waitForFunction(() => document.getElementById("mcpAccess").checked);
  await page.uncheck("#mcpAccess");
  await page.waitForFunction(async () => (await COOLMATHS_AUTH.getSettings()).mcpAccess === false);
  // The page shows the switch as off a moment before the write has landed.
  for (let i = 0; i < 25 && !(await callTool("whoami", tokens.access_token)).isError; i++) await new Promise((r) => setTimeout(r, 200));
  for (const tool of ["whoami", "my_progress", "recommend_next", "my_position"]) {
    const refused = await callTool(tool, tokens.access_token);
    check(`access off: ${tool} is refused`, refused.isError === true && /turned off/.test(refused.text));
  }

  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (err) {
  // Say where the browser was: a timeout alone does not show what went wrong.
  for (const context of browser.contexts()) {
    for (const open of context.pages()) {
      const text = await open.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => "");
      console.error(`--- page ${open.url()} ---\n${text}`);
    }
  }
  console.error(`FAIL ${err.stack || err}\n--- tutor log ---\n${tutorLog}`);
  failed = true;
} finally {
  await browser.close();
  server.close();
  tutor.kill("SIGTERM");
}
process.exit(failed ? 1 : 0);
