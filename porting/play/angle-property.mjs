// Angle Property: an illustration, so the two configurations stand in for a
// win and a loss. Drag T, then change the inversion circle and drag T again;
// the status must keep reporting two equal tangent angles. A keyboard nudge
// keeps focus on the moved dot, and Reset restores the applet's first picture.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-property

export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Point ${name},"]`).boundingBox();
    if (!handle) throw new Error(`no handle for ${name}`);
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: a shallow line through both circles, with the
  // applet's Hint and Show names boxes ticked.
  await drag("T", 0.90, 0.37);
  await page.click("#hintCheck");
  await page.click("#namesCheck");
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: a smaller inversion circle and a steep line.
  await drag("S", 0.375, 0.50);
  await drag("T", 0.90, 0.70);
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    await page.locator('[aria-label^="Point T,"]').focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press every button and switch both options off and on again.
    await page.click("#namesCheck");
    await page.click("#hintCheck");
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
    await shot("reset");
    await page.click("#hintCheck");
    await page.click("#namesCheck");
    log("options back on:", await text("#status"));
  }

  await shot("final");
};
