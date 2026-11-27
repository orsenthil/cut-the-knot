// Cross Circle is an illustration, so there is no win or loss: the scenario
// shows two configurations of the same construction. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs cross-circle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy, steps = 10) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: drag P, then reveal the centre and chord midpoints.
  await drag("P", 38, -22);
  await page.click("#hintBtn");
  log("with hint:", await text("#status"));
  await shot("hint-on");

  // Second configuration: a new P from the applet's random rule, a moved
  // triangle corner, and the hint hidden again.
  await page.click("#moveBtn");
  await drag("B", -26, 18);
  await drag("C", 14, -20);
  await page.click("#hintBtn");
  log("second shape:", await text("#status"));
  await shot("second-shape");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: arrows move a handle and focus stays with it.
  await handle("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrows:", focused.slice(0, 60));
  log("after keyboard:", await text("#status"));

  // Every button, each in both directions.
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#moveBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
