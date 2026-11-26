#!/usr/bin/env node
"use strict";

/*
 * Browser test for the home page, the app shell, and a catalogue of 1,200.
 *
 *   NODE_PATH=$(npm root -g) node porting/check-home-ui.mjs [screenshot-dir]
 *
 * Three parts:
 *   1. The real catalogue: search, the "how hard" filter and the idea filter
 *      combine, the choice is in the address, and the page has its landmarks.
 *   2. A made-up catalogue of 1,200 games served in place of assets/games.js:
 *      the page must put only one page of cards in the document, stay fast,
 *      and reach every game through "Show more".
 *   3. The app shell: the manifest is valid and its icons exist, and with
 *      the service worker installed a page opened once opens again offline.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serveRepo, launch, REPO } from "./lib/browser.mjs";

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

const cards = (page) => page.locator(".card").count();
const heading = (page) => page.textContent("#heading");
const settle = (page) => page.waitForTimeout(250);

try {
  /* ------------------------------------------------- 1. the real catalogue */

  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(`${base}/`);
  await page.waitForSelector(".card");
  const total = Number((await heading(page)).match(/\d+/)[0]);
  check("home: one <main>, a <search>, and a skip link", (await page.locator("main").count()) === 1 && (await page.locator("search").count()) === 1 && (await page.locator(".skip-link").count()) === 1);
  await page.keyboard.press("Tab");
  check("home: the first Tab lands on the skip link", (await page.evaluate(() => document.activeElement.className)) === "skip-link");
  check("home: every card image has a size and an empty alt", await page.evaluate(() => [...document.querySelectorAll(".card img")].every((i) => i.width && i.height && i.alt === "")));
  check("home: no sideways scrolling at 375px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  await page.fill("#q", "hanoi");
  await settle(page);
  const hanoi = await cards(page);
  check("search: narrows to the Hanoi games", hanoi >= 2 && hanoi < total && /hanoi/.test(await heading(page)), await heading(page));
  check("search: the query is in the address", new URL(page.url()).searchParams.get("q") === "hanoi");

  await page.click('#levels [data-level="1"]');
  check("level: combines with the search", (await cards(page)) < hanoi && (await cards(page)) >= 1 && new URL(page.url()).searchParams.get("level") === "1");
  check("level: the pressed button says so", (await page.getAttribute('#levels [data-level="1"]', "aria-pressed")) === "true");

  await page.goto(`${base}/?level=3#game-strategy`);
  await page.waitForSelector("#heading strong");
  const tricky = await page.evaluate(() => [...document.querySelectorAll(".card")].every((c) => /Tricky/.test(c.textContent) && /Game Strategy/.test(c.textContent)));
  check("a linked view opens as linked: tricky strategy games only", tricky && (await cards(page)) >= 1, await heading(page));

  // Hidden tags: a game listed under a concept it also illustrates, without the pill on its card.
  await page.goto(`${base}/#vp-vnp`);
  await page.waitForSelector("#heading strong");
  const horner = page.locator(".card", { hasText: "Horner's Method" });
  check("hidden tag: Horner's Method is listed under VP ≠ VNP", (await horner.count()) === 1, await heading(page));
  check("hidden tag: but its card shows only its own tags", !/VP ≠ VNP/.test(await horner.locator("footer").textContent()));
  const count = await page.evaluate(() => Number((document.querySelector('#filters a[href="#vp-vnp"]')?.textContent.match(/\d+/) || [0])[0]));
  check("hidden tag: the VP ≠ VNP count includes hidden-tag games", count === (await cards(page)) && count >= 11, String(count));

  await page.goto(`${base}/?q=zzzzzz`);
  await page.waitForSelector(".empty");
  check("no match: says so and offers a way back", /No games match/.test(await page.textContent(".empty")) && (await page.locator(".empty a").count()) === 1);
  check("home: no page errors", errors.length === 0, errors.join(" | "));
  if (shots) {
    await page.goto(`${base}/`);
    await page.waitForSelector(".card");
    await page.screenshot({ path: join(shots, "home.png") });
  }
  await context.close();

  /* -------------------------------------------- 2. a catalogue of 1,200 */

  const big = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const bigPage = await big.newPage();
  const tags = Array.from({ length: 180 }, (_, i) => `idea-${i}`);
  const catalogue = {
    tags: Object.fromEntries(tags.map((t, i) => [t, `Idea ${i}`])),
    games: Array.from({ length: 1200 }, (_, i) => ({
      slug: `game-${i}`,
      title: `Game number ${i}`,
      blurb: "A made-up game, here only to see how the page copes with a great many of them.",
      tags: [tags[i % 180], tags[(i * 7) % 180]],
      level: 1 + (i % 3),
      ...(i % 5 === 0 ? { kind: "demo" } : {}),
    })),
  };
  await bigPage.route("**/assets/games.js", (route) => route.fulfill({ contentType: "text/javascript", body: `window.COOLMATHS = ${JSON.stringify(catalogue)};` }));
  await bigPage.route("**/thumb.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"/>' }));

  const started = Date.now();
  await bigPage.goto(`${base}/`);
  await bigPage.waitForSelector(".card");
  const loadMs = Date.now() - started;
  check("1,200 games: the count is right", /1200 games/.test(await heading(bigPage)));
  check("1,200 games: only one page of cards is in the document", (await cards(bigPage)) === 48);
  check("1,200 games: the page is up within two seconds", loadMs < 2000, `${loadMs} ms`);
  check("1,200 games: the idea bar shows a handful, and offers the rest", (await bigPage.locator("#filters a").count()) <= 16 && /All 180 ideas/.test(await bigPage.textContent("#filters button")));
  check("1,200 games: cards down the list wait to be laid out", (await bigPage.locator(".grid > li.later").count()) === 36);

  await bigPage.click("#more");
  check("show more: adds the next page", (await cards(bigPage)) === 96);
  check("show more: focus moves to the first new card", (await bigPage.evaluate(() => document.activeElement.textContent)) === "Game number 48");

  const typed = Date.now();
  await bigPage.fill("#q", "number 1199");
  await bigPage.waitForFunction(() => /· 1 game$/.test(document.getElementById("heading").textContent));
  check("search over 1,200: answers within half a second", Date.now() - typed < 500, `${Date.now() - typed} ms`);

  await bigPage.click("#filters button");
  check("all ideas: every one is listed on request", (await bigPage.locator("#filters a").count()) === 181);
  await big.close();

  /* -------------------------------------------------- 3. the app shell */

  const manifest = JSON.parse(readFileSync(join(REPO, "manifest.webmanifest"), "utf8"));
  check("manifest: has a name, a start address and standalone display", Boolean(manifest.name && manifest.short_name) && manifest.start_url === "./" && manifest.display === "standalone");
  check("manifest: every icon exists", manifest.icons.length >= 3 && manifest.icons.every((icon) => existsSync(join(REPO, icon.src))));
  check("manifest: has a 512px icon and a maskable one", manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "any") && manifest.icons.some((i) => i.purpose === "maskable"));

  const app = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const appPage = await app.newPage();
  await appPage.goto(`${base}/`);
  // The site only registers the worker over https; here it is done by hand.
  await appPage.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await appPage.reload(); // now under the worker's control: this visit is kept
  await appPage.waitForSelector(".card");
  await appPage.goto(`${base}/hanoi/`);
  await appPage.waitForSelector("h1");
  await appPage.goto(`${base}/`);
  await appPage.waitForSelector(".card");

  await app.setOffline(true);
  await appPage.goto(`${base}/hanoi/`);
  check("offline: a game opened before opens again", /Hanoi/.test(await appPage.textContent("h1")) && (await appPage.locator(".stage").count()) >= 1);
  await appPage.goto(`${base}/`);
  await appPage.waitForSelector(".card");
  check("offline: the home page lists the games", (await cards(appPage)) > 10);
  const unseen = await appPage.goto(`${base}/kayles/`).then((r) => (r ? r.status() : 0), () => "failed");
  check("offline: a page never opened is not invented", unseen === "failed" || unseen >= 400, String(unseen));
  await app.setOffline(false);
  await appPage.goto(`${base}/kayles/`);
  check("back online: pages come from the network again", /Kayles/.test(await appPage.textContent("h1")));
  await app.close();
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
