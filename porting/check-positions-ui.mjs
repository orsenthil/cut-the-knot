#!/usr/bin/env node
"use strict";

/*
 * Browser test: the games that report their position really save one.
 *
 *   NODE_PATH=$(npm root -g) node porting/check-positions-ui.mjs [--update]
 *
 * Opens each page, makes a move where that is one click, and reads the
 * position Track saved. It must be for that game and have the same fields,
 * of the same kinds, as the saved example in porting/live-fixtures/<slug>.json.
 * (Values differ from run to run: several games deal at random.)
 *
 * Those examples are what the tutor's position readers are tested against
 * (mcp/test/positions.test.mjs), so a page that changes what it saves is
 * caught here, before the tutor misreads it. After changing a shape on
 * purpose, run with --update and fix the reader.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { serveRepo, launch, REPO } from "./lib/browser.mjs";

const update = process.argv.includes("--update");

/** slug -> one move to make before reading the position (optional). */
const GAMES = {
  coins: (page) => page.locator(".coin.end").first().click(),
  hourglass: (page) => page.locator('button[aria-label^="Turn the 7-minute"]').click(),
  "four-knights": async (page) => {
    await page.locator('button[aria-label^="Square 1:"]').first().click();
    await page.locator('button[aria-label*="press to move"]').first().click();
  },
  "four-by-four": (page) => page.locator(".cell:not([disabled])").nth(21).click(),
  torque: null,
  "mind-reader": null,
  "eye-opener": null,
  nimble: async (page) => {
    await page.selectOption("#chipsInput", "3");
    await page.locator(".chip:not(:disabled)").first().click();
  },
  "no-silver-dollar": async (page) => {
    await page.locator(".cell.counter:not(:disabled)").first().click();
  },
  "one-pile": async (page) => {
    await page.locator(".take:not(:disabled)").first().click();
    await page.waitForFunction(() => /Your move/.test(document.getElementById("status").textContent));
  },
  "odd-scoring": async (page) => {
    await page.locator('.target[data-step="2"]').click();
    await page.waitForFunction(() => /Your move/.test(document.getElementById("status").textContent));
  },
  parrondo: async (page) => {
    await page.locator("#trials").evaluate((el) => {
      el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#games").evaluate((el) => {
      el.value = "3";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("#goBtn");
    await page.waitForFunction(() => /Done|Stopped/.test(document.getElementById("status").textContent || ""));
  },
  pegsolitaire: async (page) => {
    await page.click('.cell[data-i="3"][data-j="1"]');
    await page.click('.cell[data-i="3"][data-j="3"]');
  },
  "pick-label": async (page) => {
    await page.locator(".box").nth(0).click();
  },
  "pigeon-checkers": async (page) => {
    await page.selectOption("#nInput", "3");
    await page.click('.cell[data-x="0"][data-y="1"]');
    await page.click('.cell[data-x="2"][data-y="1"]');
  },
  plainim: async (page) => {
    await page.selectOption("#colsInput", "5");
    await page.selectOption("#rowsInput", "3");
    for (let i = 0; i < 40; i++) {
      await page.click("#newBtn");
      const ok = await page.evaluate(() => {
        let chips = 0;
        let rowsWith = 0;
        for (let r = 0; r < 3; r++) {
          let rowChips = 0;
          for (let c = 0; c < 5; c++) {
            if (document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`)?.classList.contains("has-chip")) {
              chips++;
              rowChips++;
            }
          }
          if (rowChips) rowsWith++;
        }
        return chips >= 5 && rowsWith >= 2;
      });
      if (ok) break;
    }
    await page.locator(".cell.has-chip:not(:disabled)").first().click();
    await page.click("#moveBtn");
    await page.waitForFunction(() => {
      const t = document.getElementById("status").textContent || "";
      return /Your move/i.test(t) && !/won/i.test(t);
    });
  },
};

/** The shape of a value: its fields and kinds, without the values. */
function shape(value) {
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  }
  return typeof value;
}

const { server, port } = await serveRepo();
const browser = await launch();
let failed = false;

try {
  for (const [slug, move] of Object.entries(GAMES)) {
    const context = await browser.newContext({ viewport: { width: 700, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/${slug}/`);
    await page.waitForFunction(() => window.Track);
    if (move) await move(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => Track.flush());
    const live = await page.evaluate(() => Track.live());
    await context.close();

    const file = join(REPO, "porting", "live-fixtures", `${slug}.json`);
    const problems = [];
    if (errors.length) problems.push(`page errors: ${errors.join(" | ")}`);
    if (!live || live.slug !== slug) problems.push(`no position saved for ${slug}`);
    else if (update) {
      writeFileSync(file, JSON.stringify({ stateVersion: live.stateVersion, state: live.state }, null, 2) + "\n");
    } else if (!existsSync(file)) problems.push("no saved example (run with --update)");
    else {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      // Maps keyed by ids that change every deal are compared as "an object".
      const loose = (s) => JSON.stringify(s, (key, v) => (key === "placements" || key === "occupied" ? "map" : v));
      if (loose(shape(saved.state)) !== loose(shape(live.state))) {
        problems.push(`the saved position changed shape:\n  was ${loose(shape(saved.state))}\n  now ${loose(shape(live.state))}`);
      }
      if (saved.stateVersion !== live.stateVersion) problems.push("stateVersion changed");
    }

    if (problems.length) {
      failed = true;
      console.error(`FAIL ${slug}: ${problems.join("; ")}`);
    } else console.log(`ok   ${slug}${update ? " (example written)" : ""}`);
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
