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
  pm: async (page) => {
    await page.uncheck("#randomInput");
    await page.selectOption("#nInput", "5");
    await page.locator(".gap:not(:disabled)").first().click();
    await page.waitForFunction(() => {
      const t = document.getElementById("status").textContent || "";
      return /Your move/i.test(t) && !/Thinking/i.test(t);
    });
  },
  "proizvolov-game": async (page) => {
    await page.selectOption("#nInput", "3");
    await page.locator('.num[data-value="6"]').click();
    await page.locator('.num[data-value="1"]').click();
    await page.locator('.num[data-value="4"]').click();
  },
  "raisin-game": async (page) => {
    await page.uncheck("#randomInput");
    await page.selectOption("#maxInput", "8");
    await page.locator(".cut:not(:disabled)").first().click();
    await page.waitForFunction(() => {
      const t = document.getElementById("status").textContent || "";
      return /Your move|won/i.test(t) && !/Thinking/i.test(t);
    });
  },
  "reverse-desert": async (page) => {
    await page.selectOption("#colsInput", "4");
    await page.selectOption("#habInput", "3");
    await page.selectOption("#levelInput", "2");
    await page.locator('.cell[data-x="2"][data-y="0"]').click();
    await page.locator('.cell[data-x="2"][data-y="2"]').click();
  },
  "row-column-swap": async (page) => {
    await page.selectOption("#nInput", "3");
    await page.locator("#rowArrows .arrow").nth(0).click();
    await page.locator("#rowArrows .arrow").nth(1).click();
  },
  "rsolitaire": async (page) => {
    await page.selectOption("#puzzleSelect", "0");
    await page.click('.cell[data-i="3"][data-j="3"]');
    await page.click('.cell[data-i="3"][data-j="1"]');
  },
  "scoring-misere": async (page) => {
    await page.selectOption("#countersInput", "1");
    await page.selectOption("#stepInput", "3");
    await page.selectOption("#lengthInput", "8");
    await page.click("#resetBtn");
    await page.locator(".chip:not(:disabled)").first().click();
    const target = page.locator(".col.target").first();
    if (await target.count()) await target.click();
    await page.waitForTimeout(400);
  },
  "scoring-misere-2": async (page) => {
    await page.selectOption("#moveInput", "3");
    await page.selectOption("#heapInput", "15");
    await page.click("#resetBtn");
    await page.locator(".square:not(:disabled)").first().click();
    await page.waitForTimeout(400);
  },
  "sct": async (page) => {
    await page.check("#elimInput");
    await page.selectOption("#nInput", "5");
    await page.click("#resetBtn");
    await page.locator(".shape:not(.empty)").nth(0).click();
    await page.locator(".shape:not(.empty)").nth(1).click();
  },
  "sticky-problem": async (page) => {
    await page.click("#standard");
    await page.check("#modeBreak");
    await page.locator(".stick").nth(1).locator(".cell").nth(1).click();
    await page.waitForTimeout(450);
  },
  "another-sticky-problem": async (page) => {
    // Break the length 10 stick after one square, then wait for the computer.
    await page.locator('#stage .cell[data-index="0"][data-cell="1"]').click();
    await page.waitForFunction(
      () => /Your turn/.test(document.getElementById("status").textContent),
      null,
      { timeout: 20000 },
    );
  },
  "soup-fish": async (page) => {
    await page.uncheck("#computerFirst");
    await page.click("#newBtn");
    await page.locator(".card:not(:disabled)").first().click();
  },
  "table-to-zero-game": async (page) => {
    await page.selectOption("#nxInput", "2");
    await page.selectOption("#nyInput", "1");
    await page.click("#resetBtn");
    await page.locator(".col-actions .axis").first().click();
  },
  "trans-example": async (page) => {
    const box = await page.locator("#board").boundingBox();
    const x = (p) => box.x + ((p + 1) * box.width) / 6;
    const y = box.y + (box.height * 290) / 600;
    await page.mouse.move(x(0), y);
    await page.mouse.down();
    await page.mouse.move(x(2), y, { steps: 4 });
    await page.mouse.up();
  },
  "trigg-tromino": async (page) => {
    await page.evaluate(() => {
      const cell = document.querySelector("#board rect.sq:not(.hole)");
      if (cell) cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  },
  tromino: async (page) => {
    await page.selectOption("#expInput", "3");
    const box = await page.locator("#board").boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.click("#stepBtn");
  },
  "tromino-rep-tile": async (page) => {
    await page.selectOption("#expInput", "3");
    const box = await page.locator("#board").boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.click("#stepBtn");
  },
  "tromino-puzzle": async (page) => {
    await page.selectOption("#expInput", "2");
    await page.click("#blankBtn");
    const box = await page.locator("#board").boundingBox();
    const clickCell = async (row, col) => {
      await page.mouse.click(
        box.x + ((col + 0.5) * box.width) / 4,
        box.y + ((row + 0.5) * box.height) / 4,
      );
    };
    await clickCell(1, 1); // the gap
    await page.click("#playBtn");
    await clickCell(2, 2); // one L in the lower-right corner
    await clickCell(2, 3);
    await clickCell(3, 3);
  },
  "deficient-squares": async (page) => {
    await page.selectOption("#nInput", "5");
    await page.click("#blankBtn");
    const box = await page.locator("#board").boundingBox();
    const clickCell = async (row, col) => {
      await page.mouse.click(
        box.x + ((col + 0.5) * box.width) / 5,
        box.y + ((row + 0.5) * box.height) / 5,
      );
    };
    await clickCell(0, 0); // the gap
    await page.click("#playBtn");
    await clickCell(0, 1); // one L beside the gap
    await clickCell(0, 2);
    await clickCell(1, 2);
  },
  "up-and-down-game": async (page) => {
    await page.click('.tile[data-value="3"]');
    await page.click('.box[data-box="0"]');
  },
  "wythoff-nim": async (page) => {
    await page.click('#lessBtn');
    await page.click('#lessBtn');
    await page.click('.square[data-heap="0"][data-index="2"]');
    await page.waitForTimeout(500);
  },
  "y-theory": async (page) => {
    await page.locator('.ycell[data-id="0"]').click();
    await page.check("#subgameCheck");
  },
  "date-game": async (page) => {
    await page.click("#monthBtn");
    await page.click("#monthBtn");
  },
  "goat-cabbage-wolf": async (page) => {
    await page.click('.item-btn[data-item="0"]');
  },
  "subtraction-game": async (page) => {
    await page.click('.num[data-index="0"]');
    await page.click('.sub[data-index="0"]');
    await page.waitForTimeout(500);
  },
  "abacus": async (page) => {
    await page.click('.counter[data-abacus="0"][data-wire="6"][data-part="upper"][data-index="3"]');
  },
  "adams-apportionment": async (page) => {
    await page.click('input[data-part="population"][data-index="0"]');
  },
  "addition-law-of-change": async (page) => {
    await page.click('.nudge[data-part="a"][data-side="right"]');
  },
  "affirmative-action": async (page) => {
    await page.click('.node-group[data-index="0"]');
  },
  "hamilton-apportionment": async (page) => {
    await page.click('input[data-part="population"][data-index="0"]');
  },
  "all-combinations": async (page) => {
    await page.click("#mMore");
  },
  "all-permutations": async (page) => {
    await page.click('input[value="heap"]');
  },
  "isosceles-fallacy": async (page) => {
    await page.click("#modeCheck");
  },
  "apportionment-methods": async (page) => {
    await page.selectOption("#methodSelect", "webster");
  },
  "area-of-circle": async (page) => {
    await page.locator("#sectorsInput").fill("12");
  },
  "bad-limit": async (page) => {
    await page.locator("#nRange").fill("20");
  },
  "arithmetic-sequence": async (page) => {
    await page.locator('#btn9').click();
    await page.locator('#board .cell[data-index="4"]').click();
  },
  "auto-flipper": async (page) => {
    await page.click("#oneFlip");
  },
  "barcode-encoding": async (page) => {
    await page.click("#incBtn");
  },
  "binomial-distribution": async (page) => {
    await page.locator("#nSlider").fill("20");
  },
  "base-conversion": async (page) => {
    await page.locator("#text0").fill("255");
    await page.locator("#text0").press("Enter");
  },
  "barcode-magic": async (page) => {
    await page.locator('#digitRow button').nth(3).click();
    await page.click("#checkBtn");
  },
  "bachet": async (page) => {
    await page.locator('#pairList button').nth(0).click();
    await page.click("#proceedBtn");
  },
  "birds-on-wire": async (page) => {
    await page.locator("#trials").fill("200");
  },
  "bicentric-quadrilateral": async (page) => {
    await page.click("#bicentricBtn");
  },
  "cards": async (page) => {
    await page.click("#yesBtn");
  },
  "box-volume": async (page) => {
    await page.locator("#xInput").fill("2.5");
  },
  "brides-chair": async (page) => {
    await page.locator("#rotationRange").fill("45");
  },
  "chaos": async (page) => {
    await page.locator("#lambda").fill("0.892");
  },
  "btree-testing": async (page) => {
    await page.click("#newBtn");
  },
  "calculator": async (page) => {
    // The 9th key (/) is often broken; exactly one of * or / is always live.
    // Press it so the saved position keeps its temp = n/d shape.
    await page.locator(
      '#keypad button[data-key="*"]:not([disabled]), #keypad button[data-key="/"]:not([disabled])',
    ).first().click();
  },
  "chess-tournament": async (page) => {
    await page.locator("#pSlider").fill("0.8");
  },
  "buffon": async (page) => {
    await page.locator("#trials").fill("100");
  },
  "cavalieri": async (page) => {
    await page.locator("#nInput").fill("40");
  },
  "cantor": async (page) => {
    await page.locator("#aInput").fill("1.5");
  },
  "two-color-solitaire": async (page) => {
    await page.selectOption("#nInput", "8");
    const gap = await page.evaluate(() => {
      const values = [...document.querySelectorAll("#board .cards text")].map((t) => Number(t.textContent));
      for (let i = 0; i < values.length; i++) {
        if (values[i] % 2 === values[(i + 1) % values.length] % 2) return i;
      }
      return -1;
    });
    if (gap < 0) throw new Error("no legal pair was dealt");
    await page.locator(`#board .gap[data-index="${gap}"]`).click();
  },
  chvatal: async (page) => {
    await page.click("#v0");
    await page.click("#v2");
  },
  "circles-and-limit": (page) => page.locator("#rInput").fill("2"),
  "circle-with-two-centers": (page) => page.check("#cheatCheck"),
  "city-block-hunt": (page) => page.click("#cell-0-0"),
  "city-block-hunt-from-outside": (page) => page.click('button.cell[data-col="-1"][data-row="0"]'),
  "coin-change": (page) => page.click("#computeBtn"),
  collatz: (page) => page.click("#stepBtn"),
  "color-graph": (page) => page.click("#graph5"),
  "combi-gem": (page) => page.locator("#sizeInput").fill("5"),
  "common-multiples": (page) => page.locator("#pInput").fill("4"),
  "compare-fractions": (page) => page.click("#simplifyBtn"),
  "complex-numbers": (page) => page.check("input[name=mode][value=sum]"),
  coordinates: (page) => page.check("#gridBox"),
  counting: (page) => page.locator("#dots .dot").first().click(),
  "counting-squares-in-square": (page) => page.locator("#nIn").fill("5"),
  "critical-path": (page) => page.check("#critBox"),
  cwidth: (page) => page.click("#viewBtn"),
  cycloids: (page) => page.click("#markRim"),
  delian: (page) => page.click("#nMore"),
  "curry-paradox": (page) => page.locator('[data-piece="0"]').focus().then(() => page.keyboard.press("Enter")),
  "distance-to-line": (page) => page.check("#normBox"),
  "distributive-law": (page) => page.click("#cutCol"),
  "divisibility": (page) => page.locator("button.digit").first().click(),
  "ean13": (page) => page.locator("#digits button").first().click(),
  "egyptian-multiplication": (page) => page.locator("button.digit.a").last().click(),
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
