// Line Circle And Fixed Points: one configuration with V far from Q (the
// fixed point S is clear), then another with V on the other side and the Hint
// and Statement boxes on. Run with:
//   export NODE_PATH=$(npm root -g) && node porting/play.mjs line-circle-and-fixed-points
export default async ({ page, first, log, shot, text }) => {
  const boardBox = async () => page.locator("#board").boundingBox();
  const drag = async (selector, target) => {
    const box = await boardBox();
    const dot = await page.locator(selector).boundingBox();
    if (!dot || !box) throw new Error("board or handle not visible");
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 300) * box.height,
      { steps: 8 },
    );
    await page.mouse.up();
  };
  const V = '[aria-label^="Point V."]';
  const Q = '[aria-label^="Point Q."]';

  log("on opening:", await text("#status"));
  // Configuration 1: keep P, Q and O as they are, move V far to the right.
  // The fixed point is near (152, 69), well away from the moving circles.
  await drag(V, { x: 370, y: 262.5 });
  await page.click("#premiseBox");
  log("V far right:", await text("#status"));
  await shot("fixed-point");
  if (!first) return; // the dark run has taken the same screenshot

  // Configuration 2: move Q along its line and V to the left, then show the
  // tangent circle and the line through the fixed point.
  await drag(Q, { x: 250, y: 262.5 });
  await drag(V, { x: 40, y: 262.5 });
  await page.click("#statementBox");
  await page.click("#hintBox");
  log("V far left with hints:", await text("#status"));
  await shot("hints");

  // Keyboard movement must leave focus on the dragged handle.
  await page.locator(V).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Point V.")) throw new Error("keyboard focus left point V");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
