// GLaD construction: an illustration, so "play" means two configurations and
// every control. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs glad-construction
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board circle[role="button"][aria-label^="Point ${name}."]`);
  const point = (name) => page.evaluate((n) => {
    const h = [...document.querySelectorAll("#board .geom-handle")]
      .find((e) => (e.getAttribute("aria-label") || "").startsWith(`Point ${n}.`));
    return h ? { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) } : null;
  }, name);

  // Drag a handle to a target in the SVG's own 400x250 coordinates.
  const dragTo = async (name, tx, ty) => {
    const from = await point(name);
    const box = await handle(name).boundingBox();
    const svg = await page.locator("#board").boundingBox();
    if (!from || !box || !svg) throw new Error(`no handle or board for ${name}`);
    const sx = svg.width / 400, sy = svg.height / 250;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + (tx - from.x) * sx, y + (ty - from.y) * sy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));

  // First configuration: N = 2 and a slanted top side.
  await page.click("#minusBtn");
  await dragTo("D", 110, 55);
  log("two parts, slanted:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: the largest N, names on, all four corners moved.
  for (let i = 2; i < 20; i++) await page.click("#plusBtn");
  await page.click("#namesBox");
  await dragTo("A", 100, 190);
  await dragTo("B", 330, 180);
  await dragTo("C", 360, 60);
  log("twenty parts, named:", await text("#status"));
  await shot("configuration-2");

  // Keyboard-only movement keeps focus on the handle after the redraw.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  if (!first) return; // the dark run only needs the two screenshots above

  // Press every control, including both ends of the N range and both states
  // of the names tick box; the page must hold the applet's 2..20 range.
  await page.click("#plusBtn"); // at the maximum: says the range
  log("at max N:", await text("#status"), "|", await text("#nOut"));
  for (let i = 20; i > 2; i--) await page.click("#minusBtn");
  await page.click("#minusBtn"); // at the minimum: says the range
  log("at min N:", await text("#status"), "|", await text("#nOut"));
  await page.click("#namesBox");
  await page.click("#namesBox");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
