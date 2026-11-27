// Half Area Of Quadrilateral: drag the four corners into two configurations.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs half-area-of-quadrilateral
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: skew the shape and show the premise (K, E and the
  // parallel line through K).
  await drag("A", -26, 36);
  await drag("C", 36, -30);
  await page.click("#premise");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, make a different shape, turn names off and
  // back on, then show the hint (the two equal triangles and the crossing L).
  await page.click("#resetBtn");
  await drag("B", -34, 22);
  await drag("D", 30, -28);
  await page.click("#names");
  await page.click("#names");
  await page.click("#hint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order and in both directions. Unticking
  // premise must disable and clear the hint, as in the applet's panel.
  await page.click("#hint");
  await page.click("#hint");
  await page.click("#premise");
  const hintDisabled = await page.locator("#hint").isDisabled();
  log("hint disabled with premise off:", hintDisabled);
  await page.click("#premise");
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
