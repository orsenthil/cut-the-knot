// Deco Symmetry 3: look at two triangles and watch the kites cross the mirror.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs deco-symmetry-3
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const finished = () => idle(() => document.querySelector("#status")?.classList.contains("done"));

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: a scalene triangle, both applet options on.
  await drag("A", -34, -16);
  await drag("C", 24, -12);
  await page.check("#namesBox");
  await page.check("#hintBox");
  log("first triangle:", await text("#status"));
  await shot("configured");
  await page.click("#moveBtn");
  await finished();
  log("after Move them:", await text("#status"));
  await shot("moved");

  // Second configuration: reset, a different triangle, only the hint on.
  await page.click("#resetBtn");
  await page.uncheck("#namesBox");
  await page.uncheck("#hintBox");
  await drag("B", -26, 18);
  await drag("C", -20, -22);
  await page.check("#hintBox");
  log("second triangle:", await text("#status"));
  await shot("second-triangle");
  await page.click("#moveBtn");
  await finished();
  log("second finish:", await text("#status"));
  await shot("second-moved");

  if (!first) return; // the dark run already has both configurations

  // Keyboard only: focus must stay on the handle after two arrow keys.
  await page.click("#resetBtn");
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrows:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));
  await shot("keyboard");

  // Press every button and flip every checkbox in both directions.
  for (const id of ["namesBox", "hintBox"]) {
    await page.check(`#${id}`);
    await page.uncheck(`#${id}`);
  }
  await page.click("#moveBtn");
  await finished();
  log("after Reset and Move them:", await text("#status"));
  await page.click("#resetBtn");
  log("after final Reset:", await text("#status"));
};
