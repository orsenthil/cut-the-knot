// Cyclic Hexagon: two configurations of the six points, then every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cyclic-hexagon
export default async ({ page, first, log, shot, text }) => {
  async function drag(name, dx, dy) {
    const box = await page.locator(`[aria-label^="Point ${name} on the circle"]`).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  // First configuration: move two triangles so the perpendiculars are clear.
  await drag("A1", -60, 40);
  await drag("B0", 36, -42);
  log("first products:", await text("#status"));
  await shot("moving");

  // Second configuration: show all the proof circles and names, and shuffle
  // the points into a crossed (non-convex) hexagon.
  await page.click("#namesBox");
  await page.click("#sidesBox");
  await page.click("#radiiBox");
  await drag("A2", 90, -70);
  await drag("B2", -86, 30);
  log("second products:", await text("#status"));
  await shot("proof-circles");

  if (!first) return; // the dark run only needs the two pictures

  // A keyboard move must land back on the circle and keep focus on the handle.
  const a0 = page.locator('[aria-label^="Point A0 on the circle"]');
  await a0.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("after keyboard moves:", await text("#status"));
  log("focus kept:", await a0.evaluate((el) => document.activeElement === el));

  // Press every control in the order a player would, both directions.
  for (const id of ["namesBox", "sidesBox", "radiiBox"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  log("after toggles:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
