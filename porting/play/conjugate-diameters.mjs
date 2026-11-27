// ConjugateDiameters: reshape the ellipse and move P and R in two configurations.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs conjugate-diameters
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

  // First configuration: shift P around the ellipse and slide the chord.
  await drag("Point P", 34, 20);
  await drag("Chord midpoint R", -18, 12);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: stretch the ellipse, then move P and R again.
  await page.click("#resetBtn");
  await drag("Ellipse corner 2", 24, 16);
  await drag("Point P", 10, 18);
  await drag("Chord midpoint R", -10, -6);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on P after the redraw.
  await handle("Point P").focus();
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
