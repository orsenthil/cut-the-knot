#!/usr/bin/env node
"use strict";

/*
 * Browser test for the player's record, end to end:
 *
 *   NODE_PATH=$(npm root -g) node porting/check-profile-ui.mjs [screenshot-dir]
 *
 * Plays Coins in a Row to the end (a page that reports its own plays), wins
 * the Tower of Hanoi (a page that reports nothing: its #status is watched),
 * then checks the profile page and the home page show both, at phone width,
 * with no page errors and no sideways scrolling.
 */

import { join } from "node:path";
import { serveRepo, launch } from "./lib/browser.mjs";

const shots = process.argv[2] || null;
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

const readRecord = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("coolmaths-profile-v1") || "null"));

try {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  /* ---- coins: reports its own plays and positions ---- */

  await page.goto(`${base}/coins/`);
  await page.waitForSelector(".coin.end");
  for (let guard = 0; guard < 30; guard++) {
    if (await page.evaluate(() => over)) break;
    const end = page.locator(".coin.end").first();
    if (await end.count()) await end.click();
    await page.waitForTimeout(150);
  }
  check("coins: the game was played to the end", await page.evaluate(() => over));
  await page.evaluate(() => Track.flush());

  let record = await readRecord(page);
  const coins = record.progress.coins;
  check("coins: one visit, one play", coins.opens === 1 && coins.plays === 1, JSON.stringify(coins));
  check("coins: the outcome is one of win, loss or draw", ["win", "loss", "draw"].includes(record.sessions[0].outcome));
  check("coins: the options were kept", coins.lastOptions && coins.lastOptions.coins >= 2);
  check(
    "coins: the last position is the finished board",
    record.live.slug === "coins" && record.live.state.left.every((x) => x === 0) && /You \d+/.test(record.live.status),
    JSON.stringify(record.live),
  );
  check(
    "coins: the saved scores match the page",
    await page.evaluate((s) => game.scores.x === s.x && game.scores.y === s.y, record.live.state.scores),
  );

  /* ---- hanoi: reports nothing itself ---- */

  await page.goto(`${base}/hanoi/`);
  await page.waitForFunction(() => window.Track);
  // Whatever the page does, a win shows as #status.win; that is all Track sees.
  await page.evaluate(() => document.getElementById("status").classList.add("win"));
  await page.waitForFunction(() => {
    const r = JSON.parse(localStorage.getItem("coolmaths-profile-v1") || "{}");
    return r.progress && r.progress.hanoi && r.progress.hanoi.wins === 1;
  });
  await page.evaluate(() => document.getElementById("status").classList.remove("win"));
  await page.evaluate(() => document.getElementById("status").classList.add("lose"));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("coolmaths-profile-v1")).progress.hanoi.losses === 1);
  record = await readRecord(page);
  const hanoi = record.progress.hanoi;
  check("hanoi: a win and a loss were seen from #status", hanoi.plays === 2 && hanoi.completed === 1, JSON.stringify(hanoi));

  /* ---- the profile page ---- */

  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${base}/profile/`);
    await page.waitForSelector(".pick");
    if (shots) await page.screenshot({ path: join(shots, `profile-${scheme}.png`), fullPage: true });
  }
  check("profile: two games played", (await page.textContent("#statTried")).startsWith("2 of "));
  check("profile: both are listed", (await page.locator(".tried tbody tr").count()) === 2);
  check("profile: three suggestions", (await page.locator(".pick").count()) === 3);
  const suggested = await page.locator(".pick h3 a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("profile: nothing played is suggested", !suggested.some((h) => /\/(coins|hanoi)\//.test(h)), suggested.join(" "));
  check("profile: the header links here", (await page.locator('.site-header nav a[href$="profile/index.html"]').count()) === 1);
  check(
    "profile: no sideways scrolling at 375px",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );

  /* ---- the home page ---- */

  await page.goto(`${base}/`);
  await page.waitForSelector("#forYou:not([hidden])");
  check("home: suggests a next game", /Next for you/.test(await page.textContent("#forYou")));
  check("home: no sideways scrolling at 375px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (shots) await page.screenshot({ path: join(shots, "home.png") });

  /* ---- forgetting ---- */

  await page.goto(`${base}/profile/`);
  page.once("dialog", (d) => d.accept());
  await page.click("#forget");
  await page.waitForSelector("#tried .empty");
  record = await readRecord(page);
  check("profile: forgetting empties the record", Object.keys(record.progress).length === 0 && record.live === null);

  check("no page errors", errors.length === 0, errors.join(" | "));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
