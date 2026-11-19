// Area of a Circle: move the slice count to both ends with the keyboard, press
// every button, and check the picture follows the number of slices.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs area-of-circle
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  log("initial:", await text("#status"));
  await shot("start");

  // Two keyboard moves: End is the slider's maximum, Home its minimum.
  await page.focus("#sectorsInput");
  await page.keyboard.press("End");
  log("keyboard End:", await text("#status"), "| focus:", await focus());
  await shot("hundred-slices");

  await page.keyboard.press("Home");
  log("keyboard Home:", await text("#status"), "| focus:", await focus());
  await shot("three-slices");

  // Every button, in the order a player would press them.
  await page.click("#moreBtn");
  log("after More:", await text("#status"));
  await page.click("#lessBtn");
  log("after Less:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");

  // Out-of-range values clamp rather than breaking the picture.
  await page.locator("#sectorsInput").fill("1000");
  log("after an out-of-range slider value:", await text("#status"));
  await page.locator("#sectorsInput").fill("3");
  log("at the low end:", await text("#status"));

  if (!first) return; // the dark run only needs the screenshots above
};
