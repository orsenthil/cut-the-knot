// Markowsky Parabola: an illustration, so two configurations stand in for a
// win and a loss. Drag A, then move both dots with the sliders; the status must
// keep reporting the two angle readings. A keyboard nudge keeps focus on the
// moved dot, Reset restores the applet's first picture, and equal offsets give
// the applet's dead end (no construction drawn).
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs markowsky-parabola

export default async ({ page, first, log, shot, text }) => {
  const setSlider = (selector, value) =>
    page.locator(selector).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);

  const drag = async (name, t) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Point ${name} on the parabola"]`).boundingBox();
    if (!handle) throw new Error(`no handle for ${name}`);
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * ((280 + t) / 560), board.y + board.height * 0.8, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: drag A to offset 90, then tick names and the statement.
  await drag("A", 90);
  await page.click("#namesCheck");
  await page.click("#statementCheck");
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: slider offsets 35 and 120, with the hint drawn too.
  await setSlider("#aSlider", 35);
  await setSlider("#bSlider", 120);
  await page.click("#hintCheck");
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    await page.locator('[aria-label^="Point A on the parabola"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Switch every option off and on, then press Reset.
    await page.click("#hintCheck");
    await page.click("#statementCheck");
    await page.click("#namesCheck");
    await page.click("#namesCheck");
    await page.click("#statementCheck");
    await page.click("#hintCheck");
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
    await shot("reset");

    // The applet's dead end: equal offsets leave the construction unbuilt.
    await setSlider("#aSlider", 80);
    await setSlider("#bSlider", 80);
    log("dead end:", await text("#status"));
    await shot("dead-end");
    await setSlider("#bSlider", 180);
  }

  await shot("final");
};
