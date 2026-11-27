// Euclid's Segment Division: look at two configurations and the largest setting.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euclids-segment-division
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board circle[role="button"][aria-label^="Point ${name}"]`);
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
  log("opening:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: five parts, names off, hint on, all three points moved.
  await page.click("#plusBtn");
  await page.click("#plusBtn");
  await page.click("#namesBox");
  await drag("A", -32, 34);
  await drag("B", -14, 16);
  await drag("C", 20, -18);
  log("after dragging:", await text("#status"));
  await shot("configuration-2");

  // Keyboard-only moves must keep the focus on the handle after each redraw.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every option at its largest value at phone width must still fit.
  for (let i = 5; i < 20; i++) await page.click("#plusBtn");
  log("at 20 parts:", await text("#status"));
  await shot("max-n");
  await page.click("#plusBtn"); // beyond the applet's maximum: stay at 20
  const atMax = await text("#nOut");
  for (let i = 0; i < 25; i++) await page.click("#minusBtn"); // and beyond the minimum
  const atMin = await text("#nOut");
  log("range held:", atMax, "->", atMin);

  // A on BC is outside the construction: the crossing lines are hidden.
  await page.click("#resetBtn");
  const aBox = await handle("A").boundingBox();
  const bBox = await handle("B").boundingBox();
  await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2, { steps: 12 });
  await page.mouse.up();
  log("A on BC:", await text("#status"));

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  if (!first) return; // the dark run only needs the screenshots above
};
