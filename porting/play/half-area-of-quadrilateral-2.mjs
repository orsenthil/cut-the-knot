// HalfAreaOfQuadrilateral2: drag the corners to two different quadrilaterals.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs half-area-of-quadrilateral-2
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

  // First configuration: a skewed shape whose parallel through B lands on AD.
  await drag("A", 52, 28);
  await drag("C", -64, -34);
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, another shape, and the midpoint hint on.
  await page.click("#resetBtn");
  await drag("B", -48, 32);
  await drag("D", 58, -26);
  await page.click("#hint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:", await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#hint");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
