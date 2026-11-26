// BrianchonInEllipse: reshape the ellipse and move the touching points twice.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs brianchon-in-ellipse
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move two touching points so the hexagon is lopsided.
  await drag("Touching point B", 32, 22);
  await drag("Touching point E", -26, 14);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: change the ellipse itself with a corner of its box,
  // then move another point and hide the names again.
  await page.click("#resetBtn");
  await drag("Ellipse corner 1", 26, -18);
  await drag("Touching point C", 18, -24);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await handle("Touching point D").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
