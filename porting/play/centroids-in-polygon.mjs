// CentroidsInPolygon: two configurations of the polygon and its centroids.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs centroids-in-polygon
export default async ({ page, first, log, shot, idle, text }) => {
  const vertex = (i) => page.locator(`#board [aria-label^="Vertex ${i}."]`);
  const drag = async (i, dx, dy) => {
    const box = await vertex(i).boundingBox();
    if (!box) throw new Error(`no handle for vertex ${i}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a skewed 4-gon with one corner and its centroid picked.
  await drag(1, 54, 30);
  await drag(3, -40, 34);
  await page.click("#cycleBtn");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: Hint on the 4-gon shows the three medians.
  await page.check("#hint");
  log("hint on:", await text("#status"));
  await shot("hint");

  // Then a different polygon size and a different picked corner.
  await page.click("#resetBtn");
  await page.click("#nPlus");
  await page.click("#nPlus");
  await drag(2, 34, -28);
  await page.click("#cycleBtn");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the screenshots above

  // Two keyboard-only moves: focus stays on the moved vertex.
  await vertex(2).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order and drive N to both ends of 3..20.
  const minus = page.locator("#nMinus");
  const plus = page.locator("#nPlus");
  for (let i = 0; i < 25 && !(await minus.isDisabled()); i++) await minus.click();
  log("N at minimum:", await text("#nValue"), "| minus disabled:", await minus.isDisabled());
  for (let i = 0; i < 25 && !(await plus.isDisabled()); i++) await plus.click();
  log("N at maximum:", await text("#nValue"), "| plus disabled:", await plus.isDisabled());
  log("Hint off for a 20-gon:", await page.locator("#hint").isDisabled());

  for (let i = 0; i < 16; i++) await minus.click(); // back to 4
  await page.click("#cycleBtn");
  log("Hint enabled again:", !(await page.locator("#hint").isDisabled()));
  await page.check("#hint");
  log("hint back on:", await text("#status"));
  await page.uncheck("#hint");
  await page.click("#cycleBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
