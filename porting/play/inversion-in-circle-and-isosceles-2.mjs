// Inversion in a circle and an isosceles triangle II: two configurations of
// the draggable configuration, then the proof's layers and a keyboard check.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inversion-in-circle-and-isosceles-2

export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Point ${name}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 10 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: move A to make AB much shorter than AC.
  await drag("A", 0.63, 0.32);
  log("after dragging A:", await text("#status"));
  await shot("config-a");

  // Second configuration: show the last step and move B to the other side.
  await page.click('[data-step="4"]');
  await drag("B", 0.42, 0.34);
  log("after dragging B on step 4:", await text("#status"));
  await shot("config-b");

  if (first) {
    await page.locator('[aria-label^="Point C"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focused after two keyboard moves:", focused);
    log("after keyboard:", await text("#status"));

    // Every switch and every step button, in both directions.
    for (const id of ["#namesCheck", "#premiseCheck", "#statementCheck"]) await page.click(id);
    await shot("minimal");
    for (const id of ["#namesCheck", "#premiseCheck", "#statementCheck"]) await page.click(id);
    for (const step of [0, 1, 2, 3, 4, 0]) await page.click(`[data-step="${step}"]`);
    log("after all steps:", await text("#status"));

    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
    await shot("reset");
  }

  await shot("final");
};
