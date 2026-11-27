// Circum Simson: two configurations — the two perpendicular Simson lines with
// their feet and midpoints, then the crossing point traced round the
// nine-point circle. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circum-simson
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name} on the circumcircle"]`);
  const drag = async (name, dx, dy, steps = 12) => {
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

  // First configuration: perpendiculars, Simson lines and the midpoints.
  await page.check("#simsonsBox");
  await page.check("#perpsBox");
  await page.check("#midpointsBox");
  await drag("P", 42, -26);
  await drag("A", -18, 16);
  log("two simsons:", await text("#status"));
  await shot("two-simsons");

  // Second configuration: the equal-angle circles and the traced locus.
  await page.check("#anglesBox");
  await page.check("#traceBox");
  const box = await handle("P").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    const a = (2 * Math.PI * i) / 16;
    await page.mouse.move(cx + 44 * Math.cos(a), cy + 44 * Math.sin(a), { steps: 2 });
  }
  await page.mouse.up();
  log("traced:", await text("#status"));
  await shot("traced-circle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: arrows slide P on the circle and focus stays with it.
  await handle("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrows:", focused.slice(0, 60));
  log("after keyboard:", await text("#status"));

  // Every button, and every option in both directions.
  await page.click("#clearBtn");
  log("after Clear trace:", await text("#status"));
  await page.uncheck("#traceBox");
  await page.uncheck("#simsonsBox");
  log("lines off:", await text("#status"));
  await page.check("#namesBox");
  await page.uncheck("#namesBox");
  await page.check("#perpsBox");
  await page.uncheck("#perpsBox");
  await page.check("#midpointsBox");
  await page.uncheck("#midpointsBox");
  await page.check("#anglesBox");
  await page.uncheck("#anglesBox");
  await page.keyboard.press("r");
  log("after Reset:", await text("#status"));
};
