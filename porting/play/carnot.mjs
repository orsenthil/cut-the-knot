// Carnot: two configurations — the Simson line at 90°, then an equally
// inclined line at 35° with the matching triangles and circles shown.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs carnot
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name} on the circumcircle"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };
  const setAngle = (value) => page.evaluate((v) => {
    const el = document.getElementById("angleRange");
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: perpendiculars (90°) with P moved round the circle.
  await drag("P", 55, -28);
  await drag("A", 18, 14);
  log("90 degrees:", await text("#status"));
  await shot("perpendicular");

  // Second configuration: slant the lines and show the equal-angle pairs.
  await setAngle(35);
  await drag("B", -34, 22);
  await page.check("#similarBox");
  await page.check("#circlesBox");
  await page.click("#pairBtn");
  log("35 degrees:", await text("#status"));
  await shot("slanted");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: arrows slide P on the circle and the focus stays with it.
  await handle("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // The names box and Reset work in either order; Reset restores 90°.
  await page.uncheck("#namesBox");
  await page.uncheck("#similarBox");
  await page.uncheck("#circlesBox");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
