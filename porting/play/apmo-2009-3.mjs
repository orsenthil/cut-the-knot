// APMO 2009 Problem 3: drag to the isosceles position, then to a wide base
// where the right-angle position wins. Run with:
//   export NODE_PATH=$(npm root -g) && node porting/play.mjs apmo-2009-3
export default async ({ page, first, log, shot, text }) => {
  const boardBox = async () => page.locator("#board").boundingBox();
  const drag = async (selector, target) => {
    const box = await boardBox();
    const dot = await page.locator(selector).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 260) * box.height,
      { steps: 8 },
    );
    await page.mouse.up();
  };
  const A = '[aria-label^="Point A."]';

  log("on opening:", await text("#status"));
  // Names are clicked off and back on; both hints are left on for the pictures.
  await page.click("#namesBox");
  await page.click("#namesBox");
  await page.click("#hint1Box");
  await page.click("#hint2Box");

  // Configuration 1: base 220, height 120, A on the perpendicular bisector.
  // The page's claim holds here and S should meet T.
  await drag(A, { x: 200, y: 80 });
  log("isosceles:", await text("#status"));
  await shot("isosceles");
  if (!first) return; // the dark run has taken the same screenshot

  // Configuration 2: base 300 and height 60, with A near the true maximum,
  // where the angle at A is a right angle and the page's claim fails.
  await drag('[aria-label^="Point B."]', { x: 50, y: 200 });
  await drag('[aria-label^="Point C."]', { x: 350, y: 200 });
  await drag('[aria-label^="Height line."]', { x: 24, y: 140 });
  log("wide base before moving A:", await text("#status"));
  await drag(A, { x: 337, y: 140 });
  log("right angle:", await text("#status"));
  await shot("right-angle");

  // Keyboard movement must keep the focus on the handle that was moved.
  await page.locator(A).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Point A.")) throw new Error("keyboard focus left point A");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
