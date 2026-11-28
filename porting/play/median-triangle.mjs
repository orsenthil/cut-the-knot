// Median Triangle demo: drag to two different configurations, try the two
// applet checkboxes, then check two keyboard moves keep focus on the board.
// This illustration has no win or loss; the status reports the 75% invariant.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs median-triangle
export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Point ${name} of triangle ABC"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: move A, showing the names as the applet does by default.
  await drag("A", 0.30, 0.78);
  log("after dragging A:", await text("#status"));
  await shot("dragged-a");

  // Second configuration: hint on and C pulled high, making a tall triangle.
  await page.click("#hintCheck");
  await drag("C", 0.55, 0.12);
  log("hint on, after dragging C:", await text("#status"));
  await shot("second-configuration");

  if (first) {
    await page.locator('[aria-label^="Point B of triangle ABC"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press every control in both directions.
    await page.click("#newBtn");
    log("new triangle:", await text("#status"));
    await page.click("#namesCheck");
    await page.click("#hintCheck");
    await shot("names-and-hint-off");
    log("both checkboxes off:", await text("#status"));
    await page.click("#namesCheck");
    await page.click("#hintCheck");
    log("all options back on:", await text("#status"));
  }

  await shot("final");
};
