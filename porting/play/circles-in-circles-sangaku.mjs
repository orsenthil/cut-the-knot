// Circles In Circles Sangaku: show the general drawing, then the sangaku's
// special place x = r/3.  Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs circles-in-circles-sangaku
export default async ({ page, first, log, shot, idle, text }) => {
  // Configuration 1: the drawing at the applet-like starting place 0.4r,
  // with all three display options switched on.
  await page.click("#names");
  await page.click("#secondary");
  await page.click("#fill");
  log("general:", await text("#status"));
  log("general status class:", await page.getAttribute("#status", "class"));
  await shot("general");

  // Configuration 2: the 1837 sangaku point, where r3 = r4 = r5 = r/9.
  await page.click("#rightBtn");
  log("special:", await text("#status"));
  log("special status class:", await page.getAttribute("#status", "class"));
  await shot("special");

  if (!first) return; // the dark run has both screenshots already

  // Keyboard-only movement of the X handle, then the other marked point.
  await page.locator("#board .geom-handle").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after keyboard:", await text("#status"));
  await page.click("#leftBtn");
  log("left special:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
