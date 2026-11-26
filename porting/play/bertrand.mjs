// Bertrand's Paradox: two configurations of the circle, then every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bertrand
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: option 0, two free ends, one dragged by hand.
  await drag("End A", -42, -74);
  log("after dragging end A:", await text("#status"));
  await shot("two-ends");

  // Second configuration: option 2, a hundred random radii, then drag M.
  await page.click('[data-mode="2"]');
  await page.click("#batchBtn");
  log("after 100 random radii:", await text("#status"));
  await drag("Midpoint", 44, -30);
  log("after dragging midpoint:", await text("#status"));
  await shot("random-radius");

  if (!first) return; // the dark run only needs the two screenshots above

  // Press every button, and move every option in both directions.
  for (const mode of [3, 1, 0, 2, 3, 2]) await page.click(`[data-mode="${mode}"]`);
  log("after changing options both ways:", await text("#status"));
  await page.click("#drawBtn");
  log("after Draw one:", await text("#status"));
  await page.click("#batchBtn");
  log("after Draw 100:", await text("#status"));
  await page.click("#autoBtn");
  await page.waitForTimeout(350);
  await page.click("#autoBtn");
  log("after Auto on and off:", await text("#status"));

  // Two moves with the keyboard alone; focus must stay on the same handle.
  await handle("End B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard moves:", await text("#status"));

  await handle("Midpoint").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowUp");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
