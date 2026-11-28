// Lenses In Triangle: two configurations of the rolling circle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lenses-in-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  // First configuration: the circle centred on the triangle, hint and names on.
  await page.click("#hintBox");
  await page.click("#namesBox");
  log("centred:", await text("#status"));
  await shot("centred");

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: roll past the right-hand extreme to dist 55,
  // where the lens crosses side AC. Keyboard on the handle: focus it and use
  // the right arrow with Shift for larger jumps, then check focus is kept.
  await page.focus("#board .geom-handle");
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Shift+ArrowRight");
  }
  await page.fill("#distInput", "55");
  await page.dispatchEvent("#distInput", "change");
  log("past the limit:", await text("#status"));
  log("focus after keyboard:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName));
  await shot("past-limit");

  // Also use the buttons and reset, so every control is pressed in order.
  await page.click("#minusBtn");
  log("one step back:", await text("#status"));
  await page.click("#plusBtn");
  log("one step on:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
