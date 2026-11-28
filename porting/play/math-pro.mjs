// Math Pro: two configurations of the Rabinowitz concurrence, then the keyboard and every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs math-pro
export default async ({ page, first, log, shot, idle, text }) => {
  const point = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await point(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move A and P; DX, EY and FZ still meet at Q.
  await drag("A", 18, -8);
  await drag("P", 22, 12);
  await page.click("#checkBtn");
  log("near crossings:", await text("#status"));
  await shot("near");

  // Second configuration: reset, make a squat triangle, then show far points.
  await page.click("#resetBtn");
  await drag("B", 22, -28);
  await drag("C", -34, -18);
  await drag("P", -14, 22);
  await page.click("#namesBtn");
  await page.click("#farBtn");
  await page.click("#checkBtn");
  log("far crossings:", await text("#status"));
  await shot("far");

  if (!first) return; // dark run only needs the two screenshots above

  // The keyboard must move a handle without losing focus after the redraw.
  await point("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in both directions, in the order a player would.
  await page.click("#checkBtn");
  await page.click("#farBtn");
  await page.click("#farBtn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
