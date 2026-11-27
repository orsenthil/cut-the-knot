// Continuous Curve is an illustration, so two configurations stand in for a
// win and a loss. The first is the tightest spiral (100 pieces, step 2), the
// second stops early (edge gap 100, step 34). A drag and two arrow-key steps
// check that the tracing dot stays on the line and keeps keyboard focus.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs continuous-curve

export default async ({ page, first, log, shot, text }) => {
  const setRange = (id, value) => page.locator(id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: the smallest step and the most straight pieces.
  await setRange("#marginInput", 0);
  await setRange("#spreadInput", 2);
  await setRange("#legsInput", 100);
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: the widest gap and largest step; the applet stops early.
  await setRange("#marginInput", 100);
  await setRange("#spreadInput", 34);
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    await page.click("#nextBtn");
    await page.click("#nextBtn");
    log("after two Next piece presses:", await text("#status"));

    const dot = page.locator('[aria-label^="Tracing dot"]');
    await dot.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Drag the dot onto a corner, then put the sliders back through their
    // extremes and press the only remaining button.
    const board = await page.locator("#board").boundingBox();
    const handle = await dot.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * 0.7, board.y + board.height * 0.7, { steps: 8 });
    await page.mouse.up();
    log("after drag:", await text("#status"));

    await setRange("#spreadInput", 2);
    await setRange("#legsInput", 4);
    await setRange("#marginInput", 0);
    await setRange("#legsInput", 100);
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
    await shot("reset");
  }

  await shot("final");
};
