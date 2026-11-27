// Equal Circles and the Orthocenter demo: make two triangle configurations and
// show the premise, statement and hint layers. This illustration has no win or
// loss; the status line reports the equal radii and diameters.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equal-circles-orthocenter

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

  // First configuration: pull A across the top, leaving a wide acute triangle.
  await drag("A", 0.36, 0.12);
  log("after dragging A:", await text("#status"));
  await shot("dragged-a");

  // Second configuration: all four applet layers plus a flat-based triangle.
  for (const id of ["#names", "#premise", "#statement", "#hint"]) await page.click(id);
  await drag("C", 0.86, 0.82);
  log("after dragging C with all layers shown:", await text("#status"));
  await shot("all-layers");

  if (first) {
    await page.locator('[aria-label^="Point B of triangle ABC"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press the only button, then switch every checkbox off and back on.
    await page.click("#newBtn");
    log("after New diagram:", await text("#status"));
    for (const id of ["#names", "#premise", "#statement", "#hint"]) await page.click(id);
    await shot("no-layers");
    for (const id of ["#names", "#premise", "#statement", "#hint"]) await page.click(id);
    log("all layers back on:", await text("#status"));
  }

  await shot("final");
};
