// Four Incircles in a Triangle: two configurations of the same drawing.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-incircles-in-triangle
export default async ({ page, first, log, shot, text }) => {
  await shot("start");
  log("opening picture:", await text("#status"));

  // One small turn to the right takes T from 70 degrees to 67.5 degrees on
  // the sliding circle, where the applet's 0.5-pixel match test fires.
  await page.click("#rightBtn");
  log("after Turn right:", await text("#status"));
  await shot("match");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement keeps focus on T, and the two applets' options work.
  const handle = page.locator("#board .geom-handle").first();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  log("T still focused after two arrow keys:", await handle.evaluate((el) => el === document.activeElement));
  log("after keyboard moves:", await text("#status"));
  await shot("keyboard");

  await page.click("#namesChk");
  await page.click("#newBtn");
  log("after New diagram with names:", await text("#status"));
  await shot("reset");
};
