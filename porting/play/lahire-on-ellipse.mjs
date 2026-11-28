// LaHireOnEllipse: an illustration, so there is no win or loss to play through.
// The two configurations both reach the theorem's configuration; the second
// first reshapes the ellipse and moves A by hand.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lahire-on-ellipse
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

  // First configuration: put B on CD and let the applet's touch test fire.
  await page.click("#placeBtn");
  log("Put B on CD:", await text("#status"));
  await shot("first");

  // Second configuration: reshape the oval, move A, then repeat the test.
  await page.click("#resetBtn");
  await drag("Ellipse corner 1", 24, -18);
  await drag("Point A", -18, 24);
  await page.click("#namesBtn");
  await page.click("#placeBtn");
  log("reshaped ellipse, then Put B on CD:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves; focus must stay on the moved point.
  await handle("Point B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in the order a player would, in both directions.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#placeBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
