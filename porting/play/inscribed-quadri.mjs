// Inscribed Quadri: two configurations of the cyclic quadrilateral, with
// screenshots.  This is a demonstration, so there is no win or loss to play.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inscribed-quadri
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

  // First configuration: move A and C, then show the Euler lines, the three
  // centre quadrilaterals and the homotheties that join corners to copies.
  await drag("A", 54, 30);
  await drag("C", -40, -32);
  await page.click("#optEulerLines");
  await page.click("#optQuadrilaterals");
  await page.click("#optHomothety");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move the other two corners, then show every
  // remaining layer — the nine-point circles, Simson lines and maltitudes.
  await page.click("#resetBtn");
  await drag("B", -48, 36);
  await drag("D", 40, -28);
  for (const id of ["optOrthocenters", "optNinePoints", "optCentroids",
    "optNinePointCircles", "optMaltitudes", "optSimsons"]) {
    await page.click(`#${id}`);
  }
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

  // Press every checkbox in both directions, then Reset.
  for (const id of ["optOrthocenters", "optNinePoints", "optCentroids",
    "optEulerLines", "optHomothety", "optQuadrilaterals",
    "optNinePointCircles", "optMaltitudes", "optSimsons"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
