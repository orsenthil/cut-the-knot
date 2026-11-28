// Hinged Dissection of a Vase: the vase at 0 degrees, then the square at 180.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-dissection-of-vase
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the opening vase, with three quarters in its bowl.
  await shot("vase");
  log("vase:", await text("#status"));
  log("angle:", await text("#angleOut"));

  // Configuration 2: turn every piece into the square drawn by the applet.
  await page.click("#squareBtn");
  await shot("square");
  log("square:", await text("#status"));
  log("angle:", await text("#angleOut"));

  if (!first) return; // the dark run only needs both screenshots

  // Check the other controls and the keyboard on the single light run.
  await page.click("#halfBtn");
  log("halfway:", await text("#status"), await text("#angleOut"));
  await page.focus("#angleRange");
  await page.keyboard.press("ArrowRight");
  log("slider after one arrow key:", await text("#angleOut"));
  await page.click("#startBtn");
  log("back to the vase:", await text("#status"), await text("#angleOut"));
};
