#!/usr/bin/env node
"use strict";

/*
 * Play a game page in headless Chromium and look at the result in one image.
 *
 *   node porting/play.mjs <slug>          # runs porting/play/<slug>.mjs
 *
 * The scenario file exports one async function. The harness opens the game
 * at 375px, once in light and once in dark, and calls it with helpers:
 *
 *   export default async ({ page, scheme, first, log, shot, idle, text }) => {
 *     await page.click("#newBtn");
 *     log("status", await text("#status"));
 *     await shot("win");
 *   };
 *
 *   page    the Playwright page, already on the game
 *   scheme  "light" or "dark"; first is true on the light run, so a scenario
 *           can do its long checks once and only take screenshots in dark
 *   log     prints a line, prefixed with the scheme
 *   shot    saves a screenshot under that name
 *   idle    waits: idle() until no ".busy" element, idle("sel") until a selector
 *           matches, idle(() => ...) until a function run in the page is true
 *   text    textContent of a selector
 *
 * Page errors and horizontal overflow are reported after each run. All the
 * screenshots are joined side by side into one image (with ImageMagick, if it
 * is installed), so checking the look costs one image read. Output goes to
 * $TMPDIR/coolmaths-play/<slug>/.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO, serveRepo, launch } from "./lib/browser.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node porting/play.mjs <slug>");
  process.exit(2);
}
const scenarioFile = join(REPO, "porting", "play", `${slug}.mjs`);
if (!existsSync(scenarioFile)) {
  console.error(`no scenario at porting/play/${slug}.mjs`);
  process.exit(2);
}
const scenario = (await import(pathToFileURL(scenarioFile).href)).default;

const OUT = join(tmpdir(), "coolmaths-play", slug);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const { server, port } = await serveRepo();
const browser = await launch();
const shots = [];
let failed = false;

try {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 }, colorScheme: scheme });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !/wikipedia/.test(m.text())) errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/${slug}/`);
    const helpers = {
      page,
      scheme,
      first: scheme === "light",
      log: (...a) => console.log(`${scheme.padEnd(5)} ${a.join(" ")}`),
      shot: async (name) => {
        const file = join(OUT, `${scheme}-${name}.png`);
        await page.screenshot({ path: file });
        shots.push(file);
      },
      idle: (what) =>
        typeof what === "function"
          ? page.waitForFunction(what, null, { timeout: 30000 })
          : what
            ? page.waitForSelector(what, { timeout: 30000 })
            : page.waitForFunction(() => !document.querySelector(".busy"), null, { timeout: 30000 }),
      text: async (selector) => ((await page.textContent(selector)) || "").trim(),
    };
    try {
      await scenario(helpers);
    } catch (err) {
      failed = true;
      console.log(`${scheme.padEnd(5)} SCENARIO FAILED: ${err.message.split("\n")[0]}`);
      await helpers.shot("failure");
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`${scheme.padEnd(5)} page errors: ${errors.length}${errors.length ? " - " + errors[0] : ""} | overflow: ${overflow}px`);
    if (errors.length || overflow > 0) failed = true;
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (shots.length) {
  const all = join(OUT, `${slug}-all.png`);
  const magick = spawnSync("magick", [...shots, "+append", "-resize", `${Math.min(100, Math.round(1800 / shots.length / 3.75))}%`, all]);
  console.log(magick.status === 0 ? `screenshots: ${all}` : `screenshots: ${OUT}/ (install ImageMagick to get one combined image)`);
}
process.exit(failed ? 1 : 0);
