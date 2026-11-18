// Subtraction Game: use the core's Nim-sum move to win from a random board
// (letting the computer start if the board is already losing), then shrink the
// game to one heap and one subtrahend so the parity forces a loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs subtraction-game

import { loadCore } from "../lib/load-core.mjs";

const C = loadCore("subtraction-game/subtraction-game-core.js", "SubtractionGameCore");

export default async ({ page, first, log, shot, text }) => {
  const read = () =>
    page.evaluate(() => ({
      nums: [...document.querySelectorAll(".num")].map((b) => Number(b.textContent)),
      subs: [...document.querySelectorAll(".sub")].map((b) => Number(b.textContent)),
      status: document.getElementById("status").textContent,
      win: document.getElementById("status").classList.contains("win"),
      lose: document.getElementById("status").classList.contains("lose"),
      thinking: document.getElementById("status").textContent.includes("Thinking"),
    }));
  const waitReply = () =>
    page.waitForFunction(() => {
      const s = document.getElementById("status");
      return s.classList.contains("win") || s.classList.contains("lose") ||
        !s.textContent.includes("Thinking");
    }, null, { timeout: 10000 });
  // ---- a win: restore the zero Nim-sum after every computer move ----
  let board = await read();
  log("start:", board.nums.join(" "), "| subs", board.subs.join(" "));
  if (C.nimSum({ ...board, max: 100 }) === 0) {
    await page.click("#moveBtn"); // let the computer move first
    await waitReply();
    board = await read();
  }
  let turns = 0;
  while (!board.win && !board.lose && turns++ < 60) {
    const game = { ...board, max: 100, turn: "you" };
    const xor = C.nimSum(game);
    const m = xor !== 0 && C.makeGoodMove(game, xor);
    if (!m) break;
    await page.click(`.num[data-index="${m.heap}"]`);
    await page.click(`.sub[data-sub="${m.sub}"]:not([disabled])`);
    await waitReply();
    board = await read();
  }
  log(`after ${turns} of our moves:`, await text("#status"));
  log("remaining numbers:", board.nums.join(" "));
  await shot("win");

  if (first) {
    // Exercise every button and the Define option on a fresh board.
    await page.click("#resetBtn");
    await page.check("#defineCheck");
    await page.click('.sub[data-index="0"]'); // increase the first subtrahend
    log("after Define clicked a subtrahend:", (await read()).subs.join(" "));
    await shot("define");
    await page.uncheck("#defineCheck");
    await page.click('.num[data-index="0"]');
    await page.click('.sub[data-index="0"]');
    await waitReply();
    log("after a played move:", await text("#status"));
    await shot("move");
  }

  // ---- a loss: one heap, one subtrahend, so parity decides it ----
  await page.click("#resetBtn");
  for (let i = Number(await text("#numsOut")) - 1; i > 0; i--) await page.click("#numsLess"); // one minuend
  for (let i = Number(await text("#subsOut")) - 1; i > 0; i--) await page.click("#subsLess"); // one subtrahend
  let one = await read();
  log("small board:", one.nums.join(" "), "| sub", one.subs.join(" "));
  if (one.nums[0] % 2 === 1) {
    await page.click("#moveBtn"); // computer takes one, leaving an even heap
    await waitReply();
    one = await read();
  }
  let guard = 0;
  while (!one.win && !one.lose && guard++ < 40) {
    const heap = one.nums.findIndex((n) => n > 0);
    if (heap < 0) break;
    await page.click(`.num[data-index="${heap}"]`);
    await page.click('.sub:not([disabled])');
    await waitReply();
    one = await read();
  }
  log("after the parity loss:", await text("#status"));
  log("remaining numbers:", one.nums.join(" "));
  await shot("loss");
};
