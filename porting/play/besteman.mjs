// Besteman: an illustration, so "play" means two configurations + every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs besteman
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const boardBox = async () => page.locator("#board").boundingBox();
  const point = (name) => page.evaluate((n) => {
    const h = [...document.querySelectorAll("#board .geom-handle")]
      .find((e) => (e.getAttribute("aria-label") || "").startsWith(`Point ${n}.`));
    return h ? { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) } : null;
  }, name);

  // Drag a handle to a target given in the SVG's own 400x250 coordinates.
  const dragTo = async (name, tx, ty) => {
    const from = await point(name);
    const box = await handle(name).boundingBox();
    const svg = await boardBox();
    if (!from || !box || !svg) throw new Error(`no handle or board for ${name}`);
    const sx = svg.width / 400, sy = svg.height / 250;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + (tx - from.x) * sx, y + (ty - from.y) * sy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the applet's default N = 3 with a longer segment.
  await dragTo("B", 200, 115);
  log("three parts:", await text("#status"));
  await shot("n3");

  // Second configuration: the largest N, with B pulled in so C stays on screen.
  for (let i = 3; i < 20; i++) await page.click("#plusBtn");
  await dragTo("B", 125, 115);
  log("twenty parts:", await text("#status"));
  await shot("n20");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the picture follows.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control, including both ends of the N range and both ticks.
  await page.click("#plusBtn"); // at the maximum: says the range
  log("at max N:", await text("#status"));
  await page.click("#minusBtn");
  for (let i = 19; i > 2; i--) await page.click("#minusBtn");
  await page.click("#minusBtn"); // at the minimum: says the range
  log("at min N:", await text("#status"));
  await page.click("#namesBox");
  await page.click("#namesBox");
  await page.click("#hintBox");
  await page.click("#hintBox");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
