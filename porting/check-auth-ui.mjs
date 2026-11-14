#!/usr/bin/env node
"use strict";

/*
 * Browser test for sign-in and the account's record, against the Firebase
 * emulators (never the real project):
 *
 *   cd firebase && npm run test:ui
 *
 * which starts the Auth and Firestore emulators and runs this file. It needs
 * Playwright (NODE_PATH=$(npm root -g)), Java for the emulators, and network
 * access to load the Firebase SDK from its CDN.
 *
 * A guest plays, signs in, and their record must move into the account;
 * a second browser signing in as the same player must see it; signing out
 * must leave nothing of the account behind in the browser; another player
 * must see none of it; and deleting the account must remove everything.
 */

import { join } from "node:path";
import { serveRepo, launch } from "./lib/browser.mjs";

const shots = process.argv[2] || null;
const EMULATORS = { projectId: "demo-coolmaths", auth: "http://127.0.0.1:9099", firestoreHost: "127.0.0.1", firestorePort: 8080 };
const ADA = { sub: "ada-1", email: "ada@example.com", name: "Ada L." };
const BOB = { sub: "bob-1", email: "bob@example.com", name: "Bob" };

const { server, port } = await serveRepo();
const base = `http://127.0.0.1:${port}`;
const browser = await launch();
let failed = false;

function check(label, ok, detail = "") {
  if (ok) console.log(`ok   ${label}`);
  else {
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
    failed = true;
  }
}

const errors = [];
async function newVisitor() {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  await context.addInitScript((emulators) => {
    window.COOLMATHS_EMULATORS = emulators;
  }, EMULATORS);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page };
}

const localRecord = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("coolmaths-profile-v1") || "null"));
const backendName = (page) => page.evaluate(() => Track.backend().name);
const signedInAs = (page, name) => page.waitForFunction((n) => document.getElementById("who").textContent === n && !document.getElementById("signedIn").hidden, name);

async function winHanoi(page) {
  await page.goto(`${base}/hanoi/`);
  await page.waitForFunction(() => window.Track);
  await page.evaluate(() => document.getElementById("status").classList.add("win"));
}

try {
  /* ---- a guest never loads sign-in ---- */

  const first = await newVisitor();
  const page = first.page;
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await winHanoi(page);
  await page.waitForFunction(() => {
    const r = JSON.parse(localStorage.getItem("coolmaths-profile-v1") || "{}");
    return r.progress && r.progress.hanoi && r.progress.hanoi.wins === 1;
  });
  check("guest: the record is in the browser", (await backendName(page)) === "local");
  check("guest: a game page loads no sign-in code", !requests.some((u) => /auth\.js|firebasejs|googleapis|firebaseapp/.test(u)), requests.filter((u) => /firebase|auth/.test(u)).join(" "));

  /* ---- the profile page offers sign-in ---- */

  await page.goto(`${base}/profile/`);
  await page.waitForFunction(() => window.COOLMATHS_AUTH);
  await page.evaluate(() => COOLMATHS_AUTH.ready);
  await page.waitForSelector('[data-provider="google"]:not([disabled])');
  check("profile: signed out, both buttons are ready", (await page.locator("[data-provider]:not([disabled])").count()) === 2 && (await page.isVisible("#signedOut")));
  check("profile: the guest's game is listed", (await page.locator(".tried tbody tr").count()) === 1);
  if (shots) await page.screenshot({ path: join(shots, "account-signed-out.png") });

  /* ---- signing in moves the record into the account ---- */

  await page.evaluate((who) => COOLMATHS_AUTH.signInForTest(who), ADA);
  await signedInAs(page, ADA.name);
  await page.waitForFunction(() => Track.backend().name === "firebase");
  await page.waitForFunction(() => {
    const r = JSON.parse(localStorage.getItem("coolmaths-profile-v1") || "{}");
    return !r.progress || Object.keys(r.progress).length === 0;
  });
  const inAccount = await page.evaluate(() => Track.progress());
  check("sign-in: the guest's win is in the account", inAccount.hanoi && inAccount.hanoi.wins === 1, JSON.stringify(inAccount));
  check("sign-in: the browser's copy is emptied", Object.keys((await localRecord(page)).progress).length === 0);
  check("sign-in: the page says where the record is kept", /in your account/.test(await page.textContent("#where")));
  check("sign-in: the game is still listed", (await page.locator(".tried tbody tr").count()) === 1);
  // The switch is filled in a moment after the name, once the setting is read.
  const startsOn = await page.waitForFunction(() => document.getElementById("mcpAccess").checked, null, { timeout: 5000 }).then(() => true, () => false);
  check("sign-in: the tutor's access starts on", startsOn);
  if (shots) await page.screenshot({ path: join(shots, "account-signed-in.png") });

  /* ---- a signed-in player's plays go to the account, from any page ---- */

  await page.goto(`${base}/coins/`);
  await page.waitForFunction(() => window.COOLMATHS_AUTH && Track.backend().name === "firebase");
  for (let guard = 0; guard < 30; guard++) {
    if (await page.evaluate(() => over)) break;
    const end = page.locator(".coin.end").first();
    if (await end.count()) await end.click();
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => Track.flush());
  await page.waitForFunction(async () => ((await Track.progress()).coins || {}).plays === 1);
  const live = await page.evaluate(() => Track.live());
  check("signed in: coins was recorded in the account", live && live.slug === "coins" && Array.isArray(live.state.values));
  check("signed in: nothing was left in the browser", Object.keys((await localRecord(page)).progress).length === 0);

  /* ---- the setting is saved ---- */

  await page.goto(`${base}/profile/`);
  await signedInAs(page, ADA.name);
  await page.uncheck("#mcpAccess");
  await page.waitForFunction(async () => (await COOLMATHS_AUTH.getSettings()).mcpAccess === false);
  await page.reload();
  await signedInAs(page, ADA.name);
  check("setting: the tutor's access stays off after a reload", !(await page.isChecked("#mcpAccess")));

  /* ---- the same player on another device sees the same record ---- */

  const second = await newVisitor();
  await second.page.goto(`${base}/profile/`);
  await second.page.waitForFunction(() => window.COOLMATHS_AUTH);
  await second.page.evaluate((who) => COOLMATHS_AUTH.signInForTest(who), ADA);
  await signedInAs(second.page, ADA.name);
  await second.page.waitForFunction(() => document.querySelectorAll(".tried tbody tr").length === 2);
  check("second device: both games are there", true);
  await second.page.goto(`${base}/`);
  await second.page.waitForSelector("#forYou:not([hidden])");
  check("second device: the home page suggests a next game", /Next for you/.test(await second.page.textContent("#forYou")));

  /* ---- another player sees none of it ---- */

  const other = await newVisitor();
  await other.page.goto(`${base}/profile/`);
  await other.page.waitForFunction(() => window.COOLMATHS_AUTH);
  await other.page.evaluate((who) => COOLMATHS_AUTH.signInForTest(who), BOB);
  await signedInAs(other.page, BOB.name);
  await other.page.waitForFunction(() => Track.backend().name === "firebase");
  check("another player: an empty record", Object.keys(await other.page.evaluate(() => Track.progress())).length === 0);
  const stolen = await other.page.evaluate(async (uid) => {
    try {
      await Track.backend(); // the page's own backend is bob's; try ada's directly
      const { firebaseBackend } = await import("/assets/backends/firebase.js");
      const sdk = await import("https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js");
      const db = sdk.getFirestore();
      await firebaseBackend({ db, uid, sdk, core: Track.core }).readProgress();
      return "read";
    } catch (e) {
      return e.code || "refused";
    }
  }, await page.evaluate(() => COOLMATHS_AUTH.user.uid));
  check("another player: reading someone else's record is refused", stolen === "permission-denied", stolen);

  /* ---- signing out ---- */

  await page.click("#signOut");
  await page.waitForFunction(() => !document.getElementById("signedOut").hidden && Track.backend().name === "local");
  check("sign-out: the browser shows an empty record", (await page.locator(".tried tbody tr").count()) === 0);
  check("sign-out: the browser no longer loads sign-in on game pages", (await page.evaluate(() => localStorage.getItem("coolmaths-account"))) === null);

  /* ---- signing back in, then deleting the account ---- */

  await page.evaluate((who) => COOLMATHS_AUTH.signInForTest(who), ADA);
  await signedInAs(page, ADA.name);
  await page.waitForFunction(() => document.querySelectorAll(".tried tbody tr").length === 2);
  check("sign-in again: the record is back", true);

  page.once("dialog", (d) => d.accept());
  await page.click("#deleteAccount");
  await page.waitForFunction(() => !document.getElementById("signedOut").hidden);
  await page.evaluate((who) => COOLMATHS_AUTH.signInForTest(who), ADA);
  await signedInAs(page, ADA.name);
  await page.waitForFunction(() => Track.backend().name === "firebase");
  check("delete: signing in afterwards finds nothing", Object.keys(await page.evaluate(() => Track.progress())).length === 0);
  check("delete: the settings are back to their defaults", (await page.evaluate(() => COOLMATHS_AUTH.getSettings())).mcpAccess === true);

  check("no sideways scrolling at 375px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  // The one refused read above is logged by the SDK; nothing else may be.
  const unexpected = errors.filter((e) => !/permission|PERMISSION_DENIED|insufficient/i.test(e));
  check("no page errors", unexpected.length === 0, unexpected.join(" | "));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
