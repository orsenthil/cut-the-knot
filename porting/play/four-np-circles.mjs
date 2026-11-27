// Four 9-Point Circles: two configurations — the four nine-point circles with
// their centres and midpoints, then the pedal circles, feet and a highlighted
// triangle. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-np-circles
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the four nine-point circles and their centres.
  await page.check("#circlesBox");
  await page.check("#centersBox");
  await page.check("#midsBox");
  await drag("C", -26, 30);
  await drag("D", 20, -18);
  log("nine circles:", await text("#status"));
  await shot("nine-circles");

  // Second configuration: the pedal circles and the twelve feet, with one
  // triangle highlighted as the applet's repeated canvas clicks do.
  await page.check("#pedalBox");
  await page.check("#pedalPointsBox");
  await page.check("#centerQuadBox");
  await drag("A", 28, -20);
  await drag("B", -20, 26);
  await page.click("#cycleBtn");
  log("pedal circles:", await text("#status"));
  await shot("pedal-circles");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: the arrow keys move a corner and focus stays with it.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrows:", focused.slice(0, 62));
  log("after keyboard:", await text("#status"));

  // Every option in both directions and every state of the highlight cycle.
  for (const id of ["centersBox", "circlesBox", "midsBox", "centerQuadBox", "pedalBox", "pedalPointsBox"]) {
    await page.uncheck(`#${id}`);
    await page.check(`#${id}`);
    await page.uncheck(`#${id}`);
  }
  for (let i = 0; i < 5; i++) await page.click("#cycleBtn");
  log("after five clicks:", await text("#status"));
  await page.keyboard.press("r");
  log("after Reset:", await text("#status"));
};
