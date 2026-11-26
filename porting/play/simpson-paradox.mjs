// The Simpson Paradox demo: read the starting slopes, move points with the
// keyboard and by dragging, take coordinates to both extremes, toggle names
// and press Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs simpson-paradox

export default async ({ page, log, shot, text }) => {
  const verdict = async () => text("#verdict");
  const aria = async (key) => page.locator(`[data-key="${key}"]`).getAttribute("aria-label");

  log("at the start:", await verdict(), "|", await text("#status"));
  await shot("start");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator('[data-key="b1"]').focus();
  await page.keyboard.press("ArrowUp");
  let focus = await page.evaluate(() => document.activeElement?.dataset?.key);
  log("after one ArrowUp, focus:", focus, "| B1:", await aria("b1"));
  await page.keyboard.press("ArrowRight");
  focus = await page.evaluate(() => document.activeElement?.dataset?.key);
  log("after one ArrowRight, focus:", focus, "| status:", await text("#status"));
  await shot("keyboard");

  // Drag a point with the pointer, and use the larger Shift step.
  const dot = page.locator('[data-key="a1"]');
  const box = await dot.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y - 20, { steps: 6 });
  await page.mouse.up();
  log("after dragging A1:", await aria("a1"));
  await dot.focus();
  await page.keyboard.press("Shift+ArrowRight");
  log("after a Shift+ArrowRight:", await aria("a1"));
  await shot("drag");

  // Both extremes for x and y: hold Shift and keep pressing.
  await dot.focus();
  for (let i = 0; i < 40; i++) await page.keyboard.press("Shift+ArrowLeft");
  log("x at the minimum:", await aria("a1"));
  for (let i = 0; i < 40; i++) await page.keyboard.press("Shift+ArrowRight");
  log("x at the maximum:", await aria("a1"));
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowDown");
  log("y at the minimum:", await aria("a1"));
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowUp");
  log("y at the maximum:", await aria("a1"));
  await shot("extremes");

  await page.check("#namesBox");
  await page.uncheck("#namesBox");
  await page.click("#resetBtn");
  log("after Reset:", await verdict(), "|", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
