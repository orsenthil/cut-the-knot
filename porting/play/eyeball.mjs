// Eyeball: two configurations — close circles with long equal chords, then an
// overlapping pair where the tangents cannot both be drawn.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs eyeball
export default async ({ page, first, log, shot, text }) => {
  const svg = page.locator("#board");
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, target) => {
    const box = await svg.boundingBox();
    const dot = await handle(name).boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 780) * box.width,
      box.y + (target.y / 400) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));

  // Configuration 1: two similar circles brought close, with both extras on.
  await drag("Circle A centre", { x: 180, y: 200 });
  await drag("Circle A radius point", { x: 180, y: 100 });
  await drag("Circle B centre", { x: 480, y: 200 });
  await drag("Circle B radius point", { x: 480, y: 310 });
  await page.click("#rectangleBox");
  await page.click("#extraBox");
  log("close circles, rectangle and helpers:", await text("#status"));
  await shot("close");

  // Configuration 2: overlap the circles so one set of tangents vanishes.
  await page.click("#rectangleBox");
  await page.click("#extraBox");
  await page.click("#resetBtn");
  await drag("Circle B centre", { x: 250, y: 200 });
  log("overlapping circles:", await text("#status"));
  await shot("overlap");

  if (!first) return; // the dark run has taken both screenshots already

  // Arrow keys move a handle without losing keyboard focus.
  const b = handle("Circle B centre");
  await b.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  if (!focused.startsWith("Circle B centre")) throw new Error("keyboard focus left circle B");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#extraBox", "#rectangleBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
