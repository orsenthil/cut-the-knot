// Altitude And Circumcircle: drag to an acute and then an obtuse configuration.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs altitude-and-circumcircle
export default async ({ page, first, log, shot, text }) => {
  const dragCorner = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const handle = page.locator(`[aria-label^="Corner ${name}."]`);
    const dot = await handle.boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 360) * box.width,
      box.y + (target.y / 240) * box.height,
      { steps: 8 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#altitudesBox");
  await page.click("#circleBox");
  await page.click("#hintBox");

  // Configuration 1: a comfortable acute triangle with every overlay shown.
  await dragCorner("C", { x: 250, y: 90 });
  log("acute triangle:", await text("#status"));
  await shot("acute");
  if (!first) return; // the dark run has taken its screenshot of the same view

  // Configuration 2: move C past AB so the angle at C becomes obtuse.
  await dragCorner("C", { x: 185, y: 140 });
  log("obtuse triangle:", await text("#status"));
  await shot("obtuse");

  // Keyboard movement must keep the focus on the moved corner.
  const a = page.locator('[aria-label^="Corner A."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left the corner");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
