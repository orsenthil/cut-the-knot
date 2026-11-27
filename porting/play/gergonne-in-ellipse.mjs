// GergonneInEllipse: reshape the ellipse and move the touching points twice.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gergonne-in-ellipse
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

  // First configuration: slide two touch points so the triangle is lopsided.
  await drag("Touching point B", 28, -18);
  await drag("Touching point C", -20, 16);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: change the ellipse itself with a frame corner,
  // then move another touch point and check the meeting point again.
  await page.click("#resetBtn");
  await drag("Ellipse frame corner 1", 24, -16);
  await drag("Touching point A", 16, -20);
  await page.click("#checkBtn");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point, and the
  // status must keep reporting the meeting point after the redraw.
  await handle("Touching point B").focus();
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
