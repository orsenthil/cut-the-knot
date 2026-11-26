// Anticomplementary triangle demo: drag to two configurations, switch on both
// building steps, then check two keyboard moves leave focus on the board.
// This illustration has no win or loss; the status reports the invariant.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs anticomplementary-triangle

export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Point ${name} of the starting triangle"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: a tall, narrow triangle.
  await drag("A", 0.72, 0.14);
  log("after dragging A:", await text("#status"));
  await shot("dragged-a");

  // Second configuration: light up the two rounds and pull C across AB.
  await page.click("#firstCheck");
  await page.click("#secondCheck");
  await drag("C", 0.20, 0.78);
  log("after dragging C with both steps on:", await text("#status"));
  await shot("dragged-c");

  if (first) {
    await page.locator('[aria-label^="Point B of the starting triangle"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press every control: a new triangle, all options off, then back on.
    await page.click("#newBtn");
    log("new triangle:", await text("#status"));
    for (const id of ["#namesCheck", "#firstCheck", "#secondCheck"]) await page.click(id);
    await shot("minimal");
    for (const id of ["#namesCheck", "#firstCheck", "#secondCheck"]) await page.click(id);
    log("all options back on:", await text("#status"));
  }

  await shot("final");
};
