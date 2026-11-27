// CyclicQuadrilateral: two configurations of the same cyclic quadrilateral.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cyclic-quadrilateral
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

  // First configuration: pull B round the circle and show the four incenters,
  // their incircles and the rectangle they make.
  await drag("B", 26, -16);
  await page.click("#incenters");
  await page.click("#incircles");
  await page.click("#rectangle");
  await page.click("#names");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset the corners (the boxes stay ticked), move D
  // and add the diagonals, the arc bisectors and the rhombus.
  await page.click("#resetBtn");
  await drag("D", -34, -12);
  await page.click("#diagonals");
  await page.click("#arcBisectors");
  await page.click("#angleBisectors");
  await page.click("#rhombus");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner, and each
  // arrow step is projected back onto the circle.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  for (const id of ["rhombus", "angleBisectors", "arcBisectors", "diagonals",
    "names", "rectangle", "incircles", "incenters"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
