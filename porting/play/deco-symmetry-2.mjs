// Deco Symmetry 2: this is an illustration, so it has no win or loss. Play two
// different triangle shapes and watch the three pieces turn into the mirror
// image. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs deco-symmetry-2
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#moveBtn");

  // Configuration 1: the applet's starting triangle.
  await page.click("#moveBtn");
  await idle(() => document.getElementById("status").classList.contains("done"));
  log("starting triangle:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: reshape with the keyboard alone, then replay the motion.
  await page.click("#resetBtn");
  const corners = page.locator("#board .geom-handle");
  await corners.nth(0).focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
  await corners.nth(2).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute("aria-label")) || "");
  log("focus after keyboard moves:", focused);
  if (first && !/Corner M/.test(focused)) throw new Error("keyboard focus left the board");

  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#moveBtn");
  await idle(() => document.getElementById("status").classList.contains("done"));
  log("reshaped triangle:", await text("#status"));
  await shot("configuration-2");

  // Press every remaining button in the order a player would.
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
