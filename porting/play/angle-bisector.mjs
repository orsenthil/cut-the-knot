// Angle Bisector: drag the rays to two shapes, then exercise every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-bisector
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

  // First configuration: open the angle by pulling C away and B down a little.
  await drag("C", -46, 22);
  await drag("B", -24, 20);
  log("after opening the angle:", await text("#status"));
  await shot("open");

  // Second configuration: reset, then close the angle and enlarge the circles.
  await page.click("#newBtn");
  await drag("C", 42, -6);
  await drag("R", 26, -34);
  log("after closing the angle and enlarging the circles:", await text("#status"));
  await shot("closed");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the drawing follows.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await shot("checked");

  await page.click("#hintBtn");
  log("after Show hint:", await text("#status"));
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#euclidBtn");
  log("after Use DE (Euclid):", await text("#status"));
  await shot("euclid");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
