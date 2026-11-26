// Area Of Parallelogram: drag a corner into both Figure 2 configurations.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs area-of-parallelogram
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

  // First configuration: slide the base to the right. The feet stay on the
  // base, so this is the ordinary Figure 1, but the blue pieces grow.
  await drag("B", 110, 0);
  log("figure 1 (base shifted):", await text("#status"));
  await shot("figure-1");

  // Second configuration: reset, then slide A past the other end of the base,
  // with the rectangle and point names on.
  await page.click("#resetBtn");
  await drag("A", 120, 0);
  await drag("B", 30, 0);
  await page.click("#names");
  log("figure 2 (foot past the base):", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  await page.click("#cut");
  log("cut hidden:", await text("#status"));
  await page.click("#cut");
  await page.click("#newBtn");
  log("after New shape:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset diagram:", await text("#status"));
};
