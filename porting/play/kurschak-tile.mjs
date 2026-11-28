// Kürschak's Tile is a demo: there is no win or loss to play to. The two
// configurations below are the star the applet opens with and the same board
// with names and hints shown; the third shot is the finished rearrangement.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs kurschak-tile
export default async ({ page, log, shot, idle, text }) => {
  log("star, initial configuration:", await text("#status"));
  await shot("star");

  await page.check("#namesBox");
  await page.check("#hintBox");
  log("star, names and hint:", await text("#status"));
  await shot("hints");

  await page.click("#moveBtn");
  await idle(() => document.querySelector("#stepValue")?.textContent.trim() === "30 / 30");
  log("rearrangement:", await text("#status"));
  await shot("square");

  // The step handle is keyboard accessible: one ArrowLeft takes one step,
  // and focus stays on it after the redraw.
  await page.focus("circle.step-handle");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  log("step after two ArrowLefts:", await text("#stepValue"), "focus:", focus);

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), await text("#stepValue"));
};
