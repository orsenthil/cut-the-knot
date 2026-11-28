// Maimed Cake: show the cut with Z below the diagonal and then above it.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs maimed-cake
export default async ({ page, first, log, shot, idle, text }) => {
  const zHandle = page.locator('#board [aria-label^="Point Z"]');
  const boardBox = await page.locator("#board").boundingBox();
  if (!boardBox) throw new Error("no board");
  const scale = boardBox.width / 400; // viewBox units to CSS pixels
  const dragZ = async (dx, dy) => {
    const box = await zHandle.boundingBox();
    if (!box) throw new Error("no handle for Z");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx * scale, y + dy * scale, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the triangle cut BQ, with Z below BD so BZ meets CD.
  await page.click("#para");
  await dragZ(20, 10);
  log("triangle cut, Z below the diagonal:", await text("#status"));
  await shot("triangle-below");

  // Second configuration: the parallel cut PQ, with Z above BD so BZ meets AD.
  await page.click("#para");
  await dragZ(-120, -115);
  log("parallel cut, Z above the diagonal:", await text("#status"));
  await shot("parallel-above");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await zHandle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#hint");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  log("guides and names back on:", await text("#status"));
  await page.click("#newBtn");
  log("after New cake:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset picture:", await text("#status"));
};
