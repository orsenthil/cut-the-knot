// Another Sticky Problem: lose from the human start, then win by returning to
// A after "Computer starts". Also show a refused first-square click, a removal
// button and a keyboard break.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs another-sticky-problem
import { loadCore } from "../lib/load-core.mjs";

const C = loadCore("another-sticky-problem/another-sticky-problem-core.js", "AnotherStickyProblemCore");

export default async ({ page, first, log, shot, text }) => {
  const readSticks = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#stage .stick-row .len")].map((el) => Number(el.textContent)),
    );
  const ended = () =>
    page.evaluate(() => {
      const s = document.querySelector("#status");
      return s.classList.contains("win") || s.classList.contains("lose");
    });
  const waitSettled = () =>
    page.waitForFunction(() => {
      const s = document.querySelector("#status");
      if (s.classList.contains("win") || s.classList.contains("lose")) return true;
      return !!document.querySelector("#stage .cell:not(:disabled)");
    }, null, { timeout: 20000 });

  // Fill and blur: the blur fires the input's change event (and its restart)
  // before the next click, so the click is not lost to a re-render.
  const setN = async (n) => {
    await page.fill("#nInput", String(n));
    await page.locator("#nInput").evaluate((el) => el.blur());
  };

  const apply = async (move) => {
    if (move.type === "break") {
      await page
        .locator(`#stage .cell[data-index="${move.stick}"][data-cell="${move.at}"]`)
        .click();
    } else {
      await page.locator(`#removals button[data-length="${move.length}"]`).click();
    }
  };

  /** Play one turn as the human, using `choose`, and wait for the reply. */
  const turn = async (n, choose) => {
    await waitSettled();
    if (await ended()) return false;
    const sticks = await readSticks();
    const state = { n, sticks };
    const moves = C.legalMoves(state);
    if (moves.length === 0) return false;
    const move = choose(state, moves);
    await apply(move);
    await waitSettled();
    return true;
  };

  // A human start is an A position, so any legal human line loses.
  const loseGame = async (n) => {
    await setN(n);
    let guard = 0;
    while (!(await ended()) && guard++ < 200) {
      await turn(n, (state, moves) => moves.find((m) => m.type === "remove") || moves[0]);
    }
    log(`N = ${n}, human starts:`, await text("#status"), `(${guard} human turns)`);
    await shot("loss");
  };

  // "Computer starts" gives the human a B position; returning to A every turn wins.
  const winGame = async (n) => {
    await setN(n);
    await page.click("#computerStarts");
    let guard = 0;
    while (!(await ended()) && guard++ < 200) {
      await turn(n, (state, moves) => {
        const reply = moves.find((m) => C.classOf(C.move(state, m)) === "A");
        if (!reply) throw new Error(`no move back to A from [${state.sticks.join(",")}]`);
        return reply;
      });
    }
    log(`N = ${n}, computer starts:`, await text("#status"), `(${guard} human turns)`);
    await shot("win");
  };

  if (first) {
    // The refused first square.
    await setN(4);
    await page.locator('#stage .cell[data-index="1"][data-cell="0"]').click();
    log("first-square click:", await text("#status"));
    await shot("not-allowed");

    // A removal: the 1+2 start already offers "remove one of length 1".
    await setN(1);
    await page.locator('#removals button[data-length="1"]').click();
    log("after removing one length-1 stick, the board is:", (await readSticks()).join(" + ") || "empty");
    await waitSettled();
    log("after the computer's reply:", await text("#status"));
    await shot("removal");

    // A keyboard break, and the focus that survives the computer's reply.
    await setN(4);
    await page.focus('#stage .cell[data-index="0"][data-cell="1"]');
    await page.keyboard.press("Enter");
    await waitSettled();
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el && el.classList.contains("cell") ? el.getAttribute("aria-label") : String(el && el.tagName);
    });
    log("after a keyboard break, focus is on:", focused);
    await shot("keyboard");

    await loseGame(5);
  }

  // The dark run repeats a short loss and a short win, with N = 1.
  if (first) {
    await winGame(8);
  } else {
    await loseGame(1);
    await winGame(1);
  }
};
