// Circles And Regular Triangle: explore two configurations of the illustration.
// It is a demonstration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-and-regular-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = () => page.locator('#board [aria-label^="Point B"]');
  const drag = async (dx, dy) => {
    const box = await handle().boundingBox();
    if (!box) throw new Error("no handle for point B");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: all four drawing options on, B slid towards C.
  // The small circle grows, and its centre stays straight above B.
  for (const id of ["#names", "#premise", "#statement", "#colors"]) await page.click(id);
  await drag(30, 0);
  log("configuration 1 (B towards C, all options shown):", await text("#status"));
  await shot("configuration-1");

  // Second configuration: reset, then slide B towards A with just the
  // premise and statement shown. The triangle is still isosceles, W shrinks.
  await page.click("#colors");
  await page.click("#names");
  await page.click("#resetBtn");
  await drag(-38, 0);
  log("configuration 2 (B towards A):", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two keyboard-only moves: the focus must stay on B after the redraw.
  await handle().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  await page.click("#colors");
  await page.click("#premise");
  await page.click("#statement");
  log("all drawing options off:", await text("#status"));
  await page.click("#statement");
  await page.click("#premise");
  await page.click("#colors");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset diagram:", await text("#status"));
};
