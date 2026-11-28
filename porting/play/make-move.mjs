// Make Move: show the spelled board, press Reset to swap the last two
// counters, slide a tile, then play two moves with the keyboard alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs make-move
export default async ({ page, first, log, shot, text }) => {
  log("opening board:", await text("#status"));
  await shot("solved");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("swapped");

  // The gap is at column 4, row 4; press the E, tile to its left.
  await page.click('#board [data-cell="2,3"]');
  log("after a long slide:", await text("#status"));
  await shot("slid");

  if (first) {
    await page.locator("#board .cursor-handle").focus();
    await page.keyboard.press("ArrowUp"); // chooses a square above the gap
    await page.keyboard.press("Enter");
    log("after keyboard slide:", await text("#status"));
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("class"));
    log("focus after keyboard slide:", focused);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    log("after second keyboard slide:", await text("#status"));
    log("status class:", await page.getAttribute("#status", "class"));
    await page.keyboard.press("ArrowLeft");
  }

  await page.click("#slideBtn");
  log("after Slide button:", await text("#status"));
  await shot("button");

  // Replay the 16-slide solution that the logic test found, to reach the
  // spelled message from the Reset board and show the finished play.
  await page.click("#resetBtn");
  const solution = [[3, 1], [2, 1], [2, 3], [1, 3], [1, 1], [3, 1], [3, 3], [2, 3],
    [2, 2], [1, 2], [1, 1], [2, 1], [2, 2], [1, 2], [1, 3], [3, 3]];
  for (const [x, y] of solution) await page.click(`#board [data-cell="${x},${y}"]`);
  log("after the solution:", await text("#status"));
  log("finished class:", await page.getAttribute("#status", "class"));
  await shot("spelled-again");
};
