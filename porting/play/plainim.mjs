// Plainim: win by always leaving nim-sum 0 on a fixed small board; lose by
// always clearing the leftmost chip of the first non-empty row; then the
// largest board; keyboard moves; Misère and option extremes.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/i.test(document.getElementById("status").textContent);
  const over = async () => /won/i.test(await text("#status"));

  await page.selectOption("#colsInput", "4");
  await page.selectOption("#rowsInput", "2");

  // Play from the live random board using the core's winningMoves each turn.
  async function playWinning(maxSteps) {
    for (let k = 0; k < maxSteps && !(await over()); k++) {
      const move = await page.evaluate(() => {
        const snap = window.Track && window.Track._lastState;
        // Read heaps from the DOM instead.
        const cols = Number(document.getElementById("colsInput").value);
        const rows = Number(document.getElementById("rowsInput").value);
        const heaps = [];
        for (let r = 0; r < rows; r++) {
          let h = 0;
          for (let c = 0; c < cols; c++) {
            const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            if (cell && cell.classList.contains("has-chip")) h |= PlainimCore.bitForCol(cols, c);
          }
          heaps.push(h);
        }
        const state = PlainimCore.start({ cols, rows, heaps, misere: false });
        const wins = PlainimCore.winningMoves(state);
        if (!wins.length) return null;
        return wins[0];
      });
      if (!move) {
        // Losing position: clear selection path — take any legal cell.
        const any = page.locator(".cell.has-chip:not(:disabled)").first();
        if (await any.count()) await any.click();
        else break;
      } else {
        // Clear any prior selection by Reset is wrong; toggle each bit in the mask.
        const cols = Number(await page.locator("#colsInput").inputValue());
        for (let col = 0; col < cols; col++) {
          const bit = 1 << (cols - col - 1);
          // bitForCol uses POWERS[cols-col-1] which equals 1<<(cols-col-1) for cols<=12
          if (move.mask & bit) {
            await page.locator(`.cell[data-row="${move.row}"][data-col="${col}"]`).click();
          }
        }
      }
      if (k < 2) {
        // Two moves with the keyboard on the Make move button / board focus.
        await page.locator("#moveBtn").focus();
        await page.keyboard.press("Enter");
        await idle(thinking);
        if (k === 0 && !(await over())) {
          log("focus after computer:", await page.evaluate(() => document.activeElement && (document.activeElement.getAttribute("aria-label") || document.activeElement.id)));
        }
      } else {
        await page.click("#moveBtn");
        await idle(thinking);
      }
    }
  }

  // Keep dealing until the opening nim-sum is non-zero, then play perfectly.
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.click("#newBtn");
    const sum = await page.evaluate(() => {
      const cols = Number(document.getElementById("colsInput").value);
      const rows = Number(document.getElementById("rowsInput").value);
      const heaps = [];
      for (let r = 0; r < rows; r++) {
        let h = 0;
        for (let c = 0; c < cols; c++) {
          const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
          if (cell && cell.classList.contains("has-chip")) h |= PlainimCore.bitForCol(cols, c);
        }
        heaps.push(h);
      }
      return heaps.reduce((x, h) => x ^ h, 0);
    });
    if (sum === 0) continue;
    await playWinning(30);
    if (await over()) break;
  }
  log("win:", await text("#status"), "|", await text("#score"));
  await shot("win");
  if (!first) return;

  // Loss: always remove only the leftmost chip of the first non-empty row.
  await page.selectOption("#colsInput", "4");
  await page.selectOption("#rowsInput", "3");
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.click("#newBtn");
    for (let k = 0; k < 40 && !(await over()); k++) {
      const target = await page.evaluate(() => {
        const cols = Number(document.getElementById("colsInput").value);
        const rows = Number(document.getElementById("rowsInput").value);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            if (cell && cell.classList.contains("has-chip")) return { r, c };
          }
        }
        return null;
      });
      if (!target) break;
      await page.locator(`.cell[data-row="${target.r}"][data-col="${target.c}"]`).click();
      await page.click("#moveBtn");
      await idle(thinking);
    }
    if (/I won/i.test(await text("#status"))) break;
  }
  log("loss:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  // Largest board + Misère + option extremes.
  await page.selectOption("#colsInput", "12");
  await page.selectOption("#rowsInput", "12");
  await page.check("#misereInput");
  await page.locator(".cell:not(:disabled)").first().click();
  await shot("largest");

  await page.selectOption("#colsInput", "3");
  await page.selectOption("#rowsInput", "2");
  await page.uncheck("#misereInput");
  // Keyboard: arrow to a chip and Space, then Make move with Enter.
  await page.locator(".cell.has-chip:not(:disabled)").first().focus();
  await page.keyboard.press(" ");
  await page.locator("#moveBtn").focus();
  await page.keyboard.press("Enter");
  await idle(thinking);
  log("after keyboard move:", await text("#status"));
  await shot("keyboard");
};
