// Euler Nagel In Quad: an illustration, so there is no win or loss to play
// through. Show two different quadrilateral configurations with the centre
// lines switched on, then exercise the keyboard and every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-nagel-in-quad
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const ids = ["circumcenters", "orthocenters", "centroids",
    "ninePoints", "diagonals", "eulerLines"];
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };
  const ensureChecked = async (id, on) => {
    const box = page.locator(`#${id}`);
    if ((await box.isChecked()) !== on) await box.click();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a skewed quadrilateral with its diagonals and two
  // families of triangle centres visible.
  await drag("A", 32, 26);
  await drag("C", -42, -30);
  for (const id of ["orthocenters", "centroids", "diagonals"]) await ensureChecked(id, true);
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move two other corners, show everything.
  await page.click("#resetBtn");
  await drag("B", -46, 38);
  await drag("D", 52, -24);
  for (const id of ids) await ensureChecked(id, true);
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  for (const id of ids) {
    await ensureChecked(id, false);
    await ensureChecked(id, true);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
