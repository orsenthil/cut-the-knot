// Circles And Square: explore two configurations of the droodle.
// It is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-and-square
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

  // First configuration: name the points and slide K towards M. P should
  // still sit on the diagonal AC.
  await page.click("#names");
  await drag("K", 8, -22);
  log("configuration 1 (K slid towards M):", await text("#status"));
  await shot("configuration-1");

  // Second configuration: move M and N to new places on their sides, then
  // slide K the other way. The circles move, P stays on the diagonal.
  await page.click("#resetBtn");
  await drag("M", 22, 0);
  await drag("N", -18, 0);
  await drag("K", -6, 20);
  log("configuration 2 (M, N and K moved):", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await handle("K").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  log("names off:", await text("#status"));
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset diagram:", await text("#status"));
};
