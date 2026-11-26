// Al-Nayrizi Construction: drag the points into two configurations and look at
// the cuts. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs al-nayrizi-construction
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

  // Second configuration: more marks, both options on, all three points moved.
  for (let i = 0; i < 3; i++) await page.click("#plusBtn");
  await page.click("#namesBox");
  await page.click("#hintBox");
  await drag("A", -34, 26);
  await drag("B", -16, 12);
  await drag("C", 22, -16);
  log("after dragging:", await text("#status"));
  await shot("configuration-2");

  // Keyboard-only moves keep the focus on the handle and update the cuts.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every option at its largest value, at phone width, must still fit.
  for (let i = 6; i < 20; i++) await page.click("#plusBtn");
  log("at 20 marks:", await text("#status"));
  await shot("max-n");
  await page.click("#plusBtn"); // beyond the applet's maximum: stay at 20
  const atMax = await text("#nOut");
  for (let i = 0; i < 25; i++) await page.click("#minusBtn"); // and beyond the minimum
  const atMin = await text("#nOut");
  log("range held:", atMax, "->", atMin);

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  if (!first) return; // the dark run only needs the screenshots above
};
