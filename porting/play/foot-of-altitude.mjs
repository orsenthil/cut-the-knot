// Foot Of Altitude: show the minimum at the altitude foot, then an obtuse triangle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs foot-of-altitude
export default async ({ page, log, shot, text }) => {
  const dragPoint = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const handle = page.locator(`[aria-label^="Point ${name}."]`);
    const dot = await handle.boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 250) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#premiseBox");
  await page.click("#hintBox");
  log("with the overlays:", await text("#status"));

  // Configuration 1: D at the foot of the altitude from A; the two bars match.
  await dragPoint("D", { x: 222, y: 208.3 });
  log("D at the foot:", await text("#status"));
  await shot("at-foot");

  // Configuration 2: an obtuse base angle (the foot lies beyond B) with D away.
  await dragPoint("A", { x: 30, y: 80 });
  await dragPoint("D", { x: 270, y: 208.3 });
  log("obtuse triangle:", await text("#status"));
  await shot("obtuse");

  // Keyboard movement must keep focus on the handle that was moved.
  const d = page.locator('[aria-label^="Point D."]');
  await d.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Point D.")) throw new Error("keyboard focus left D");

  // Press the remaining controls in both directions.
  await page.click("#premiseBox");
  await page.click("#hintBox");
  await page.click("#namesBox");
  log("names off:", await text("#status"));
  await page.click("#namesBox");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
