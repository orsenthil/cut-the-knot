// Equilateral Triangles on a Parallelogram: two configurations of the same
// construction. This is a demonstration, so there is no win or loss to play.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equi-tri-on-para
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
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

  // First configuration: reshape the parallelogram and show the names and
  // the first round of equilateral triangles.
  await drag("B", 40, -26);
  await drag("D", -34, 24);
  await page.click("#names");
  await page.click("#first");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move the other two corners and show both
  // rounds, so the second set can be seen landing back on the first corners.
  await page.click("#newBtn");
  await drag("A", -30, 20);
  await drag("C", 36, -28);
  await page.click("#second");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  await page.click("#names");
  await page.click("#first");
  await page.click("#first");
  await page.click("#second");
  await page.click("#second");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
