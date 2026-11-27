// From Grebe illustration: two triangle configurations, then keyboard moves.
// There is no win or loss; the status reports the common point and scale.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs from-grebe

export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Vertex ${name}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: pull A' up and right, leaving a long, flat triangle.
  await drag("A", 0.78, 0.18);
  log("after dragging A':", await text("#status"));
  await shot("configuration-1");

  // Second configuration: show the names and pull C' down across A'B'.
  await page.click("#namesCheck");
  await drag("C", 0.22, 0.86);
  log("after dragging C' with names on:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    await page.locator('[aria-label^="Vertex B"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press every control in player order: reset, names off, names back on.
    await page.click("#newBtn");
    log("after reset:", await text("#status"));
    await page.click("#namesCheck");
    await shot("minimal");
    await page.click("#namesCheck");
    log("names back on:", await text("#status"));
  }

  await shot("final");
};
