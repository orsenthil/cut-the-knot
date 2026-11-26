// Carpets In Quadri: an illustration, so there is no win or loss to play
// through. Show two different quadrilateral configurations, then exercise
// every control and the keyboard-only moves.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs carpets-in-quadri
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(
    name === "P" ? '#board [aria-label^="Point P"]' : `#board [aria-label^="Corner ${name}"]`);
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

  // First configuration: skew the quadrilateral and slide P along AB.
  await drag("A", 54, 26);
  await drag("C", -42, -30);
  await drag("P", 26, 0);
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, make a different shape, show the proof.
  await page.click("#resetBtn");
  await drag("B", -58, 38);
  await drag("D", 36, -26);
  await page.click("#hint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved handle.
  await handle("D").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focusedCorner = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two corner arrow keys:", focusedCorner);
  await handle("P").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focusedP = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two P arrow keys:", focusedP);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#hint");
  log("hint off:", await text("#status"));
  await page.click("#hint");
  log("hint on:", await text("#status"));
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
