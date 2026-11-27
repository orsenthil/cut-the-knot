// Circles And Parallels: explore two configurations of the droodle.
// It is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-and-parallels
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: all drawing options on, P slid along AB. Q moves,
  // but the line PQ should still go through the same X.
  await page.click("#names");
  await page.click("#hint");
  await drag("P", 24, 14);
  log("configuration 1 (P slid along AB):", await text("#status"));
  await shot("configuration-1");

  // Second configuration: a different triangle and P the other way. The two
  // circles and Q change, the fixed point does not.
  await page.click("#resetBtn");
  await drag("C", -20, 18);
  await drag("P", -12, -7);
  log("configuration 2 (reshaped triangle):", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await handle("P").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  await page.click("#hint");
  log("all drawing options off:", await text("#status"));
  await page.click("#hint");
  await page.click("#names");
  await drag("A", 14, 0);
  await drag("B", -14, 0);
  log("after moving both ends of AB:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset diagram:", await text("#status"));
};
