// Clifford's Lemma, an illustration: take two different circle arrangements,
// then use the keyboard and Reset. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs clifford-theorem
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: drag the rim dot of circle 2, changing its radius.
  const board = await page.locator("#board").boundingBox();
  const rim = await page.locator('[aria-label^="Circle 2 rim point"]').boundingBox();
  await page.mouse.move(rim.x + rim.width / 2, rim.y + rim.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width * 0.68, board.y + board.height * 0.26, { steps: 10 });
  await page.mouse.up();
  log("after dragging circle 2's rim:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: keyboard only, moving circle 4's centre with Shift+arrow.
  await page.locator('[aria-label^="Circle 4 centre"]').focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowLeft");
  log("focus after keyboard moves:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  log("after keyboard moves:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    // The one button on the page, and all eight handles reachable by arrow key.
    await page.click("#resetBtn");
    log("after Reset:", await text("#status"));
    await shot("reset");
    for (const name of ["Circle 1 centre", "Circle 1 rim point", "Circle 2 centre",
      "Circle 2 rim point", "Circle 3 centre", "Circle 3 rim point",
      "Circle 4 centre", "Circle 4 rim point"]) {
      await page.locator(`[aria-label^="${name}"]`).focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowDown");
    }
    log("after moving every handle:", await text("#status"));
    await shot("keyboard");
  }
};
