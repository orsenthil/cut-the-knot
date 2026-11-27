// CyQuadri: two configurations of the angle-bisector quadrilateral.
// This is an illustration with no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cy-quadri
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

  // First configuration: a tilted quadrilateral with internal bisectors and
  // the two angle halves at each corner marked.
  await drag("B", 8, -28);
  await page.click("#angles");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: start again, move D, and switch to the outside
  // halving lines.  The new circle should still pass through all crossings.
  await page.click("#resetBtn");
  await drag("D", -30, 22);
  await page.click("#external");
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

  // Press every control in a player's order, in both directions.
  await page.click("#internal");
  await page.click("#external");
  await page.click("#internal");
  await page.click("#angles");
  await page.click("#angles");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
