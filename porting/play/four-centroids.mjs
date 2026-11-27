// FourCentroids: two configurations of the same illustration.
// The applet has no win or loss, so the scenario changes points and options,
// checks that the three lines still meet at G, and saves two screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-centroids
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move P and B into a skew shape, show the parallels.
  await drag("P", 34, -46);
  await drag("B", -26, 42);
  await page.check("#statement1");
  log("first shape, statement 1:", await text("#status"));
  await shot("first");

  // Second configuration: reset, a different shape, all three proof overlays.
  await page.click("#resetBtn");
  await drag("C", -22, -40);
  await drag("A", -30, -26);
  await page.check("#statement2");
  await page.check("#premises");
  log("second shape, all overlays:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves; focus must stay on the moved point.
  await handle("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press the remaining control and change every checkbox in both directions.
  for (const id of ["names", "statement1", "statement2", "premises"]) {
    await page.uncheck(`#${id}`);
    await page.check(`#${id}`);
  }
  log("all four checkboxes on:", await text("#status"));
  for (const id of ["names", "statement1", "statement2", "premises"]) await page.uncheck(`#${id}`);
  log("all four checkboxes off:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
