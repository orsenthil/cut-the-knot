#!/usr/bin/env node
"use strict";

/*
 * Browser test: the games that report their position really save one.
 *
 *   NODE_PATH=$(npm root -g) node porting/check-positions-ui.mjs [--update] [--only <slug>]
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
// --only <slug> checks one game (handy when repeating a flaky one).
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

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
  "gcd-by-factor-tree": async (page) => {
    await page.click("#newBtn");
  },
  "gcd-lcm-rectangles": async (page) => {
    await page.fill("#mInput", "12");
    await page.locator("#mInput").press("Enter");
  },
  "gencon-construction": async (page) => {
    await page.locator('.control-row input').first().fill("120");
    await page.locator('.control-row input').first().press("Enter");
  },
  "rouse-ball-fallacy": async (page) => {
    await page.check("#hintCheck");
  },
  "archimedes-circumference": async (page) => {
    await page.locator("#nInput").fill("12");
    await page.locator("#nInput").dispatchEvent("input");
  },
  "euler-hamilton-paths": async (page) => {
    await page.locator(".node").first().click();
  },
  "huntington-hill-method": async (page) => {
    await page.click("#seatsMore");
  },
  "hilbert-curve": async (page) => {
    await page.locator("#orderInput").fill("4");
    await page.locator("#orderInput").dispatchEvent("input");
  },
  "hooper-paradox": async (page) => {
    await page.fill("#wInput", "12");
    await page.locator("#wInput").press("Enter");
  },
  "horner-method": async (page) => {
    await page.fill("#tInput", "3");
    await page.locator("#tInput").press("Enter");
  },
  "iterated-function-systems": async (page) => {
    await page.selectOption("#systemSel", "Fern");
  },
  "imo-1986-3": async (page) => {
    await page.click("#stepBtn");
  },
  "indy-clock-hands": async (page) => {
    await page.fill("#alphaInput", "90");
    await page.locator("#alphaInput").press("Enter");
  },
  "infinite-latin-square": async (page) => {
    await page.locator("#levelInput").fill("4");
    await page.locator("#levelInput").dispatchEvent("input");
  },
  "integer-rectangle": async (page) => {
    await page.fill("#wInput", "2");
    await page.locator("#wInput").dispatchEvent("input");
  },
  "interest-rates": async (page) => {
    await page.check('input[name="mode"][value="investment"]');
  },
  "integer-rectangle-graph": async (page) => {
    await page.check("#graphCheck");
  },
  "robinson-induction": async (page) => {
    await page.click("#splitBtn");
  },
  "winkler-path-proof": async (page) => {
    await page.check("#bordersCheck");
  },
  "sums-products-invariant": async (page) => {
    await page.locator(".number").first().click();
    await page.locator(".number").last().click();
  },
  "isbn-encoding": async (page) => {
    await page.locator(".isbn-cell").first().click();
  },
  "item-parity": async (page) => {
    await page.locator('.cell[data-key="0,0"]').click();
    await page.locator('.cell[data-key="0,1"]').click();
  },
  "item-parity-generalized": async (page) => {
    await page.fill("#redsInput", "5");
    await page.locator("#redsInput").dispatchEvent("input");
  },
  "critical-path-scheduling": async (page) => {
    await page.selectOption("#procSel", "4");
  },
  "jefferson-apportionment": async (page) => {
    await page.click("#seatsMore");
  },
  "john-sharp-paradox": async (page) => {
    await page.click("#revealBtn");
  },
  "johnson-trotter": async (page) => {
    await page.click("#stepBtn");
  },
  "mandelbrot-julia": async (page) => {
    const box = await page.locator("#mandelbrot").boundingBox();
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.2);
  },
  "kaprekar-routine": async (page) => {
    await page.click("#runBtn");
  },
  "langford-skolem": async (page) => {
    await page.check('input[value="skolem"]');
  },
  "langman-paradox": async (page) => {
    await page.check("#cheatCheck");
  },
  "latin-squares": async (page) => {
    await page.locator(".grid-row").first().locator(".cell").nth(0).click();
    await page.locator(".grid-row").first().locator(".cell").nth(1).click();
  },
  "lattice-multiplication": async (page) => {
    await page.fill("#aInput", "123");
    await page.locator("#aInput").press("Enter");
  },
  "lcm-algorithm": async (page) => {
    await page.click("#stepBtn");
  },
  "leibniz-triangle": async (page) => {
    await page.check('input[value="leibniz"]');
  },
  "game-of-life": async (page) => {
    await page.selectOption("#patternSel", "glider");
  },
  "life-like-automaton": async (page) => {
    await page.selectOption("#presetSel", "highlife");
  },
  "logistic-model": async (page) => {
    await page.fill("#rInput", "3.5");
    await page.locator("#rInput").dispatchEvent("input");
  },
  "lone-divider": async (page) => {
    await page.click("#solveBtn");
  },
  "long-multiplication": async (page) => {
    await page.uncheck("#compactCheck");
  },
  "other-primes": async (page) => {
    await page.check("#showX");
  },
  "square-sieve": async (page) => {
    for (let i = 0; i < 3; i++) await page.click("#stepBtn");
  },
  "euler-product": async (page) => {
    await page.locator("#n").evaluate((el) => { el.value = 120; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  "prime-counting": async (page) => {
    await page.locator("#e").evaluate((el) => { el.value = 4; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  "zeta-critical-line": async (page) => {
    await page.click("#nextBtn");
  },
  "prime-waves": async (page) => {
    await page.locator("#k").evaluate((el) => { el.value = 10; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  "harmonic-series": async (page) => {
    await page.locator("#e").evaluate((el) => { el.value = 3; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  "basel-problem": async (page) => {
    await page.locator("#e").evaluate((el) => { el.value = 2; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  // The Unit Distance path.
  "unit-distance-points": async (page) => {
    await page.click("#showBtn");
  },
  "two-circles-two-points": null,
  "moser-spindle-colouring": async (page) => {
    await page.locator(".node").first().click();
  },
  "sums-of-two-squares": async (page) => {
    await page.click("#nextBtn");
  },
  "grid-spacing-dial": async (page) => {
    await page.click("#showBtn");
  },
  "unit-distance-growth": async (page) => {
    await page.locator("#k").evaluate((el) => { el.value = 36; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  "roots-of-unity-lattice": async (page) => {
    await page.locator("#r").evaluate((el) => { el.value = 3; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  "no-equilateral-triangles": null,
  // Nine more ports.
  "loop-or-halt": null,
  "magic-in-square": async (page) => {
    await page.locator(".pick").first().click();
  },
  "mandel-cycle": async (page) => {
    await page.click("#goBtn");
    await page.click("#goBtn");
  },
  markers: null,
  "math-telepathy": async (page) => {
    for (const d of [3, 3, 6]) await page.locator("#pad button").nth(d).click();
    await page.click("#guessBtn");
  },
  means: async (page) => {
    await page.locator("#r").evaluate((el) => { el.value = 1; el.dispatchEvent(new Event("input", { bubbles: true })); });
  },
  memory: async (page) => {
    await page.locator(".card").first().click();
  },
  merlin: async (page) => {
    await page.locator("#board .b").first().click();
  },
  "midline-in-sim-tris": null,
  // Ten more ports.
  "hummers-mind-reader": async (page) => {
    await page.locator(".coin").first().click();
  },
  "min-max": null,
  "miu-system": async (page) => {
    await page.locator("#rules4 button").nth(1).click();
  },
  "modular-tables": async (page) => {
    await page.locator("td button").nth(3).click();
  },
  "monty-hall": async (page) => {
    await page.locator(".door").nth(1).click();
  },
  "moving-chips-in-pairs": null,
  "multiplication-table": async (page) => {
    await page.locator('td button[data-a="3"][data-b="4"]').click();
  },
  "mean-value-theorem": async (page) => {
    await page.click("#findBtn");
  },
  "napier-bones": null,
  "napoleon-polygons": null,
  // Ten more ports.
  "signs-and-sums": async (page) => {
    await page.locator('button[aria-label="Increase number 1"]').click();
  },
  "newtons-method": async (page) => {
    await page.fill("#x0In", "4.5");
    await page.dispatchEvent("#x0In", "change");
    await page.fill("#nIn", "3");
    await page.dispatchEvent("#nIn", "change");
  },
  "nine-squares": async (page) => {
    await page.click("#nineBtn");
  },
  "golden-ratio-pentagon": null,
  "northcotts-game": async (page) => {
    await page.locator("#board .cell.mine").first().click();
  },
  "counting-triangles": async (page) => {
    await page.fill("#aIn", "128");
    await page.dispatchEvent("#aIn", "input");
  },
  "zeros-and-ones-array": async (page) => {
    await page.click("#bestBtn");
  },
  "adding-functions": async (page) => {
    await page.check("#opSub");
  },
  "orthogonal-latin-squares": async (page) => {
    await page.click("#showBtn");
  },
  "kochs-snowflake": async (page) => {
    await page.fill("#nIn", "4");
    await page.dispatchEvent("#nIn", "input");
  },
  "pascal-triangle": async (page) => {
    await page.locator("#board circle.dot").nth(7).click();
  },
  "peasant-multiplication": async (page) => {
    await page.check("#binIn");
  },
  "pendula-chaos": null,
  perm: null,
  "perm-by-trans": async (page) => {
    await page.locator('#board circle[aria-label="Pole 1, height 1"]').click();
    await page.locator('#board circle[aria-label="Pole 3, height 1"]').click();
  },
  "perm-group": null,
  "perm-on-circle": async (page) => {
    await page.locator("#board circle.node").nth(0).click();
    await page.locator("#board circle.node").nth(1).click();
  },
  "perm-product": null,
  pick: async (page) => {
    const box = await page.locator("#board").boundingBox();
    for (const [x, y] of [[2, 2], [8, 2], [8, 6], [2, 6]]) await page.mouse.click(box.x + ((24 + x * 32) / 464) * box.width, box.y + ((24 + y * 32) / 336) * box.height);
  },
  pigeonhole: null,
  "plain-monty-hall": async (page) => {
    await page.locator(".door").nth(0).click();
  },
  "play-hex-design": async (page) => {
    await page.locator("#board .dot").nth(4).click();
    await page.locator("#board .dot").nth(5).click();
  },
  "polygonal-numbers": async (page) => {
    await page.fill("#sides", "6"); await page.dispatchEvent("#sides", "change");
  },
  "polynomial-degree-3": async (page) => {
    for (const [n, v] of [["a", 1], ["b", -6], ["c", 11], ["d", -6]]) await page.fill("#s" + n, String(v));
  },
  "polynomial-roots": async (page) => {
    const box = (i) => page.locator("#formula input").nth(i);
    for (const [i, v] of [[0, 2], [1, -3], [2, 1], [3, 1]]) { await box(i).fill(String(v)); await box(i).dispatchEvent("change"); }
  },
  "power-index": async (page) => {
    await page.check("#computeBox");
  },
  "power-indices": async (page) => {
    await page.selectOption("#setSel", "Security Council");
  },
  "primes-from-triangle": async (page) => {
    await page.check("#ancBox");
    await page.focus("#board");
    for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowDown");
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
  },
  "product-of-fractions": async (page) => {
    for (const [id, v] of [["#pIn", 1], ["#rIn", 1], ["#qIn", 3], ["#pIn", 2], ["#sIn", 4], ["#rIn", 3]]) { await page.fill(id, String(v)); await page.dispatchEvent(id, "change"); }
  },
  "pyth-triple-calculator": async (page) => {
    await page.fill("#nIn", "3"); await page.dispatchEvent("#nIn", "change");
  },
  "quadratic-polynomial": async (page) => {
    for (const [n, v] of [["a", 1], ["b", 2], ["c", 4]]) await page.fill("#s" + n, String(v));
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
  "enemy-ambassadors": (page) => page.locator("#table g.place").first().click(),
  "equilateral-fibonacci": (page) => page.fill("#nIn", "55"),
  "euclid-alg": (page) => page.fill("#numIn", "1000").then(() => page.press("#numIn", "Enter")),
  "euclid-algorithm": (page) => page.locator("button.digit.a").last().click(),
  "factorization": (page) => page.click("#goBtn"),
  "farey": (page) => page.click("#moreBtn"),
  "fc-exercise": (page) => page.locator("button.digit").first().click(),
  "fibonacci-cheat": (page) => page.locator("#pieceBtns button").first().click(),
  "fif": (page) => page.locator("#board button.sq").first().click(),
  "figurate": (page) => page.fill("#nIn", "5").then(() => page.press("#nIn", "Tab")),
  "fill-the-board": (page) => page.locator("#grid button").first().click(),
  "first-proof": (page) => page.locator("#pins g.pin").first().click({ force: true }),
  "flavius": (page) => page.locator("#ring g.place").first().click({ force: true }),
  "flip-them-ii": (page) => page.locator("#ring g.disc").first().click({ force: true }),
  "flip-them-iii": (page) => page.locator("#ring g.disc").first().click({ force: true }),
  "fourth-degree": (page) => page.locator("#c3").evaluate((e) => { e.value = "2"; e.dispatchEvent(new Event("input", { bubbles: true })); }),
  "fraction-comparison-exercise": (page) => page.click("#sign1"),
  "futurama": (page) => page.locator("#ring g.body").first().click({ force: true }),
  ratchet: (page) => page.check('input[name="show"][value="regular"]'),
  "more-less-equal": (page) => page.click('[data-nudge="b:1"]'),
  "sam-loyd-son": (page) => page.click('#pieceBtns button[data-id="0"]'),
  scoring: async (page) => {
    const at = await page.evaluate(() => [...document.querySelectorAll("#board .col")].findIndex((c) => c.querySelector(".chip") && c.dataset.square !== "0"));
    await page.click(`#board [data-square="${at}"]`);
    await page.click(`#board [data-square="${at - 1}"]`);
    await page.waitForFunction(() => /Your move|won/.test(document.getElementById("status").textContent));
  },
  "geometric-series-square": async (page) => {
    await page.check('input[name="kind"][value="3"]');
    for (let i = 0; i < 3; i++) await page.click("#moreBtn");
  },
  "shuttle-practice": async (page) => {
    const box = await page.locator("#board").boundingBox();
    const y = box.y + (180 / 600) * box.height;
    await page.mouse.move(box.x + (1 / 6) * box.width, y);
    await page.mouse.down();
    await page.mouse.move(box.x + (2 / 6) * box.width, y, { steps: 5 });
    await page.mouse.up();
  },
  "sierpinski-chaos-game": async (page) => {
    await page.fill("#delayInput", "0");
    await page.dispatchEvent("#delayInput", "change");
    await page.click("#startBtn");
    await page.waitForTimeout(400);
    await page.click("#stopBtn");
  },
  "sierpinski-dihedral": (page) => page.click('#stepBtns [data-steps="4"]'),
  "simple-somos": (page) => page.click('[data-bump="m:1"]'),
  "sine-cosine-derivatives": async (page) => {
    await page.focus("#board .handle");
    await page.keyboard.press("PageUp");
    await page.keyboard.press("PageUp");
  },
  "sine-of-sum": async (page) => {
    await page.focus('#boardL .handle[data-which="alpha"]');
    await page.keyboard.press("PageDown");
  },
  "social-choice": async (page) => {
    for (const m of [1, 3]) await page.check(`input[data-method="${m}"]`);
    await page.click('[data-ballot="2"][data-index="1"]');
  },
  soroban: async (page) => {
    await page.click('#board .bead[data-wire="6"][data-bead="1"]');
    await page.click('#board .bead[data-wire="5"][data-bead="heaven"]');
  },
  "suan-pan": async (page) => {
    await page.click('#board .bead[data-wire="6"][data-bead="2"]');
    await page.click('#board .bead[data-wire="5"][data-bead="h0"]');
  },
  sorts: async (page) => {
    await page.selectOption("#methodSel", "3");
    for (let i = 0; i < 4; i++) await page.click("#stepBtn");
  },
  "spigot-for-pi": async (page) => {
    await page.fill("#nIn", "50");
    await page.click("#computeBtn");
    await page.waitForFunction(() => document.getElementById("status").classList.contains("done"));
  },
  "steinhaus-problem": async (page) => {
    await page.focus("#board .tile.waiting");
    await page.keyboard.press("Enter");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowLeft");
    await page.focus("#board .tile.waiting");
    await page.keyboard.press("Enter");
  },
  "string-distance": async (page) => {
    await page.check('input[value="levenshtein"]');
    await page.fill("#sIn", "kitten"); await page.fill("#tIn", "sitting");
    await page.click("#doBtn");
  },
  "switching-signs": async (page) => {
    await page.click('#grid [data-row="0"]');
  },
  "base-tables": async (page) => {
    await page.check('input[value="x"]');
    await page.fill("#radixIn", "12"); await page.dispatchEvent("#radixIn", "change");
  },
  tesseract: async (page) => {
    await page.click("#skipBtn");
    await page.locator("#dest button").first().click();
  },
  "party-acquaintances": async (page) => {
    for (const [a, b] of [[0, 1], [1, 2]]) { await page.click(`#board .node[data-i="${a}"]`); await page.click(`#board .node[data-i="${b}"]`); }
  },
  "triangle-chain": async (page) => {
    for (const [k, p] of [[0, 0], [1, 1], [1, 0]]) await page.click(`#board .cell[data-k="${k}"][data-p="${p}"]`);
  },
  "stick-in-three": async (page) => {
    await page.selectOption("#method", "longer");
    await page.click("#many");
  },
  "stick-in-square": async (page) => {
    await page.check('input[name="mode"][value="two"]');
    await page.click("#many");
  },
  "tromino-monomino": async (page) => {
    for (const [a, b] of [[[0, 0], [0, 2]], [[1, 0], [3, 0]]]) {
      await page.click(`#board .cell[data-i="${a[0]}"][data-j="${a[1]}"]`);
      await page.click(`#board .cell[data-i="${b[0]}"][data-j="${b[1]}"]`);
    }
  },
  "turning-turtles": async (page) => {
    const o = await page.evaluate(() => [...document.querySelectorAll("#row .sq")].findIndex((b) => !b.classList.contains("x")));
    await page.click(`#row .sq[data-i="${o}"]`);
    await page.click("#moveBtn");
    await page.waitForTimeout(1000);
  },
  "chips-on-circle": async (page) => {
    for (const i of [0, 3]) await page.click(`#board .chip[data-i="${i}"]`);
  },
  "two-perpendiculars": async (page) => {
    await page.check('input[name="fallacy"][value="2"]');
  },
  "two-men-of-tibet": async (page) => {
    await page.focus('#board .handle[data-i="1"]');
    await page.keyboard.press("ArrowUp");
  },
  "det-and-perm": async (page) => {
    await page.click('#grid .cell[data-k="0"]');
    await page.click('#grid .cell[data-k="8"]');
  },
  "rook-placements": async (page) => {
    const p = await page.evaluate(() => RookPlacementsCore.placements(RookPlacementsCore.board(4, 1))[0]);
    for (let i = 0; i < p.length; i++) await page.click(`#board [data-i="${i}"][data-j="${p[i]}"]`);
  },
  "arithmetic-circuits": async (page) => {
    await page.selectOption("#puzzleIn", "sq");
    await page.selectOption("#aIn", { index: 1 }); await page.selectOption("#opIn", "+"); await page.selectOption("#bIn", { index: 2 }); await page.click("#addBtn");
  },
  "determinant-elimination": async (page) => {
    await page.click("#stepBtn"); await page.click("#stepBtn");
  },
  "ryser-formula": async (page) => {
    await page.click("#nextBtn"); await page.click("#nextBtn"); await page.click("#nextBtn");
  },
  "perm-from-det": async (page) => {
    await page.click('#grid [data-k="1"]');
  },
  "riskless-hedge": async (page) => {
    for (let k = 0; k < 10; k++) await page.click("#moreBtn");
  },
  "stock-price-paths": async (page) => {
    await page.click("#newBtn");
  },
  "quadratic-roots": async (page) => {
    await page.locator("#slider-a").evaluate((el) => {
      el.value = "2";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  },
  "random-walk": (page) => page.click("#oneBtn"),
  "reflection-principle": (page) => page.click("#oneBtn"),
  "right-replacement": (page) => page.click("#computeBtn"),
  s1089: (page) => page.click("#randomBtn"),
  "sealed-bids": (page) => page.click("#newBidsBtn"),
  "self-descriptive": (page) => page.click("#iterateBtn"),
  "simple-automaton": (page) => page.click("#stepBtn"),
  "simple-graphs": (page) => page.locator("#diagram").click({ position: { x: 12, y: 12 } }),
  "simpson-paradox": (page) => page.check("#namesBox"),
  "two-numbers": async (page) => {
    await page.click("#numA");
    await page.fill("#sumIn", "12");
    await page.click("#guessBtn");
  },
  upc: (page) => page.locator("button.digit[data-i='0']").click({ position: { x: 4, y: 8 } }),
  water: (page) => page.click(".pour[data-from='2'][data-to='1']"),
  "arith-magic": async (page) => {
    for (let i = 0; i < 5; i++) await page.click(`.cell[data-r="${i}"][data-c="${i}"]`);
  },
  "universal-coloring": async (page) => {
    await page.click("#board .dot[data-i='0']");
    await page.click("#board .dot[data-i='1']");
  },
  "zeros-and-nines": (page) => page.click("#checkBtn"),
  "very-tiles": async (page) => {
    await page.click("#tilesGrid .cell[data-pos='0']");
    await page.click("#problemsGrid .cell[data-pos='0']");
  },
  "up-and-down": (page) => page.click("#hiddenBtn"),
  voting: (page) => page.selectOption("#methodIn", "borda"),
  wgraphs: async (page) => {
    await page.click("#kruskalBtn");
    await page.click('[data-edge="0"]');
  },
  "a-bisector": (page) => dragFirstHandle(page),
  "ab-on-circumcircle": (page) => dragFirstHandle(page),
  "abul-wafa-pythagoras": (page) => dragFirstHandle(page),
  "adams-circle": (page) => dragFirstHandle(page),
  "adjacent-incircles": (page) => dragFirstHandle(page),
  "al-nayrizi-construction": (page) => dragFirstHandle(page),
  "altitude-and-circumcircle": (page) => dragFirstHandle(page),
  "altitude-mirror": (page) => dragFirstHandle(page),
  "altitude-mirror-2": (page) => dragFirstHandle(page),
  angle: (page) => dragFirstHandle(page),
  "angle-between-tangent-and-chord": (page) => dragFirstHandle(page),
  "angle-bisector": (page) => dragFirstHandle(page),
  "angle-bisector-in-equilateral-trapezoid": (page) => dragFirstHandle(page),
  "angle-bisector-in-rectangle": (page) => dragFirstHandle(page),
  "angle-bisector-ratio": (page) => dragFirstHandle(page),
  "angle-bisector-ratio-2": (page) => dragFirstHandle(page),
  "angle-bisectors-in-quadri": (page) => dragFirstHandle(page),
  "angle-on-diameter": (page) => dragFirstHandle(page),
  "angle-property": (page) => dragFirstHandle(page),
  "angles-in-circle": (page) => dragFirstHandle(page),
  "angles-in-triangle": (page) => dragFirstHandle(page),
  "anonymous-visitor": (page) => dragFirstHandle(page),
  "anticomplementary-triangle": (page) => dragFirstHandle(page),
  antiparallel: (page) => dragFirstHandle(page),
  "any-quadri": (page) => dragFirstHandle(page),
  "apmo-2009-3": (page) => dragFirstHandle(page),
  "apollonian-circle": (page) => dragFirstHandle(page),
  apollonius: (page) => dragFirstHandle(page),
  arbelos: (page) => dragFirstHandle(page),
  "arbelos-bui": (page) => dragFirstHandle(page),
  "arbelos-concyclic": (page) => dragFirstHandle(page),
  "arbelos-incircle": (page) => dragFirstHandle(page),
  "arbelos-pww": (page) => dragFirstHandle(page),
  "arbelos-rect": (page) => dragFirstHandle(page),
  archi: (page) => dragFirstHandle(page),
  "archimedes-lever": (page) => dragFirstHandle(page),
  "archimedes-quadruplets": (page) => dragFirstHandle(page),
  "archimedes-triangle": (page) => dragFirstHandle(page),
  "area-of-parallelogram": (page) => dragFirstHandle(page),
  "area-of-triangle": (page) => dragFirstHandle(page),
  "areas-in-reg-poly": (page) => dragFirstHandle(page),
  "areas-in-square": (page) => dragFirstHandle(page),
  "arrange-pyth": (page) => dragFirstHandle(page),
  "asia-pacific-kite": (page) => dragFirstHandle(page),
  "auxetic-tessellation": (page) => dragFirstHandle(page),
  "balls-in-jar": (page) => dragFirstHandle(page),
  "baltic-darij-1": (page) => dragFirstHandle(page),
  barlotti: (page) => dragFirstHandle(page),
  barycentric: (page) => dragFirstHandle(page),
  barygon: (page) => dragFirstHandle(page),
  bender: (page) => dragFirstHandle(page),
  bertrand: (page) => dragFirstHandle(page),
  besteman: (page) => dragFirstHandle(page),
  "besteman-2": (page) => dragFirstHandle(page),
  "bevan-point": (page) => dragFirstHandle(page),
  "bicentric-quadri-2": (page) => dragFirstHandle(page),
  bicolor: (page) => dragFirstHandle(page),
  bid: (page) => dragFirstHandle(page),
  "bimedians-in-tetrahedron": (page) => dragFirstHandle(page),
  "bisectal-circle": (page) => dragFirstHandle(page),
  "bisector-circle-triad": (page) => dragFirstHandle(page),
  "blithe-12": (page) => dragFirstHandle(page),
  "bol-1": (page) => dragFirstHandle(page),
  "bol-10": (page) => dragFirstHandle(page),
  "bol-12": (page) => dragFirstHandle(page),
  "bol-13": (page) => dragFirstHandle(page),
  "bol-2": (page) => dragFirstHandle(page),
  "bol-3": (page) => dragFirstHandle(page),
  "bol-5": (page) => dragFirstHandle(page),
  "bol-6": (page) => dragFirstHandle(page),
  "bol-9": (page) => dragFirstHandle(page),
  bottema: (page) => dragFirstHandle(page),
  "bqt-lemma": (page) => dragFirstHandle(page),
  bqtn: (page) => dragFirstHandle(page),
  brahmagupta: (page) => dragFirstHandle(page),
  "brahmagupta-2": (page) => dragFirstHandle(page),
  "breadth-width": (page) => dragFirstHandle(page),
  brianchon: (page) => dragFirstHandle(page),
  "brianchon-in-ellipse": (page) => dragFirstHandle(page),
  "brick-wall": (page) => dragFirstHandle(page),
  "broken-chord": (page) => dragFirstHandle(page),
  "broken-chord-mr-homm": (page) => dragFirstHandle(page),
  "broken-chord-paper-folding": (page) => dragFirstHandle(page),
  "building-bridge": (page) => dragFirstHandle(page),
  "building-bridges": (page) => dragFirstHandle(page),
  "bui-quang-tuan": (page) => dragFirstHandle(page),
  "bui-quang-tuan-2": (page) => dragFirstHandle(page),
  "bulging-lines": (page) => dragFirstHandle(page),
  butterfly: (page) => dragFirstHandle(page),
  "butterfly-in-ellipse": (page) => dragFirstHandle(page),
  "binomial-option-tree": async (page) => {
    await page.selectOption("#nIn", "6");
  },
  "payoff-heat-equation": async (page) => {
    await page.fill("#tauIn", "1"); await page.dispatchEvent("#tauIn", "input");
  },
  "black-scholes-formula": async (page) => {
    await page.fill("#KIn", "110"); await page.dispatchEvent("#KIn", "input");
  },
  "delta-hedging": async (page) => {
    await page.fill("#sharesIn", "0.52"); await page.dispatchEvent("#sharesIn", "change");
    await page.click("#nextBtn");
  },
};

/** Move the first draggable point of an illustration with the keyboard. */
async function dragFirstHandle(page) {
  await page.locator("#board .geom-handle").first().focus();
  await page.keyboard.press("ArrowRight");
}

/** The shape of a value: its fields and kinds, without the values. */
function shape(value) {
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  }
  return typeof value;
}

/**
 * Whether two shapes agree. An empty list says nothing about what it would
 * hold, so it agrees with any list: a random deal can leave a list empty on
 * one run (no joints of one colour, say) and full on the next.
 */
function sameShape(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return !a.length || !b.length || sameShape(a[0], b[0]);
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameShape(a[k], b[k]));
  }
  return a === b;
}

const { server, port } = await serveRepo();
const browser = await launch();
let failed = false;

try {
  for (const [slug, move] of Object.entries(GAMES)) {
    if (only && slug !== only) continue;
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
      const strip = (v) => JSON.parse(loose(v));
      if (!sameShape(strip(shape(saved.state)), strip(shape(live.state)))) {
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
