// Cyclic Incenters: two different configurations of the four points on the
// circle. This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cyclic-incenters
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Point ${name} on the circle"]`);
  const drag = async (name, fx, fy) => {
    const handle = corner(name);
    const box = await handle.boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + fx * box.width, y + fy * box.height, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull B around and show the four incenters and their
  // circle, which is the page's claim.
  await drag("B", 0.25, -0.18);
  await page.click("#opt-smallCircles");
  await page.click("#opt-circle");
  log("first configuration:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move two other points and reveal the centre
  // lines, the exsimilicenter point and the names.
  await page.click("#resetBtn");
  await drag("D", -0.22, 0.12);
  await drag("A", -0.14, -0.1);
  await page.click("#opt-centerLines");
  await page.click("#opt-point");
  await page.click("#opt-names");
  log("second configuration:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two keyboard-only moves: focus must stay on the moved point.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  for (const id of ["#opt-names", "#opt-point", "#opt-centerLines", "#opt-circle", "#opt-smallCircles"]) {
    await page.click(id);
  }
  for (const id of ["#opt-diagonals", "#opt-bisectors", "#opt-inscribedDiagonals",
    "#opt-bigCircles", "#opt-circumcircles", "#opt-inscribedPolygon", "#opt-addOn",
    "#opt-segment", "#opt-tangents", "#opt-homotheties", "#opt-secondIteration"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
