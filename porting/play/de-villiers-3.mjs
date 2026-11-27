// de Villiers 3: drag the four dots into two different configurations.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs de-villiers-3
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull B along the circle, show names, angle marks
  // and the two circles.
  await drag("B", 34, -16);
  await page.click("#names");
  await page.click("#angles");
  await page.click("#circles");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move C and D, and turn on every overlay.
  await page.click("#resetBtn");
  await drag("C", -30, 22);
  await drag("D", 26, -18);
  for (const id of ["#perps", "#bisectors", "#centers", "#diagonals", "#radii"]) {
    await page.click(id);
  }
  log("second shape:", await text("#status"));
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
  for (const id of ["#names", "#angles", "#perps", "#bisectors", "#centers",
    "#diagonals", "#radii", "#circles"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
