// Circles On Perp Bisector: show the theorem configuration and a dragged one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-on-perp-bisector
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const dot = await handle(name).boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 360) * box.width,
      box.y + (target.y / 240) * box.height,
      { steps: 12 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));

  // Configuration 1: move O to where I is the incircle and show all overlays.
  // Then one internal tangent is parallel to BC and the other antiparallel.
  await drag("Circle centre O", { x: 180, y: 145.5 });
  await page.click("#namesBox");
  await page.click("#tangentsBox");
  await page.click("#stBox");
  log("incircle position, overlays on:", await text("#status"));
  await shot("theorem");

  // Configuration 2: a stretched triangle with O far below BC.
  await drag("Point A", { x: 145, y: 30 });
  await drag("Point B", { x: 70, y: 150 });
  await drag("Point C", { x: 320, y: 125 });
  await drag("Circle centre O", { x: 180, y: 216 });
  log("stretched triangle, O low:", await text("#status"));
  await shot("stretched");

  if (!first) return; // the dark run has taken both screenshots already

  // Arrow keys keep focus on the handle, including for O (which slides along
  // the perpendicular bisector rather than moving freely in x and y).
  const a = handle("Point A");
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  let focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys on A:", focused);
  if (!focused.startsWith("Point A")) throw new Error("keyboard focus left point A");
  log("status after keyboard:", await text("#status"));

  const o = handle("Circle centre O");
  await o.focus();
  await page.keyboard.press("ArrowDown");
  focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys on O:", focused);
  if (!focused.startsWith("Circle centre O")) throw new Error("keyboard focus left point O");

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#tangentsBox", "#stBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
