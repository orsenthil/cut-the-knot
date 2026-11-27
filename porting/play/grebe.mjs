// Grebe illustration: two triangle configurations in two views, then keyboard
// moves. There is no win or loss; the status reports the invariant being shown.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs grebe

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

  // First configuration: the default Grebe view with a long, flat triangle.
  await drag("C", 0.48, 0.12);
  log("after dragging C (Grebe):", await text("#status"));
  await shot("configuration-1");

  // Second configuration: names on, van Lamoen (OK), and a different shape.
  await page.click("#namesCheck");
  await page.check('input[name="mode"][value="OK"]');
  await drag("A", 0.22, 0.82);
  await drag("B", 0.80, 0.72);
  log("after dragging A and B (OK):", await text("#status"));
  await shot("configuration-2");

  if (first) {
    // The third view and the keyboard: focus must survive the redraw.
    await page.check('input[name="mode"][value="KO"]');
    await page.locator('[aria-label^="Vertex B"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("after keyboard (KO):", await text("#status"));
    await shot("keyboard");

    // Press every control in player order: reset, names off, names on,
    // Grebe again, and a second reset.
    await page.click("#newBtn");
    log("after reset:", await text("#status"));
    await page.click("#namesCheck");
    await page.check('input[name="mode"][value="grebe"]');
    await page.click("#newBtn");
    await shot("minimal");
    await page.click("#namesCheck");
    log("names back on:", await text("#status"));
  }

  await shot("final");
};
