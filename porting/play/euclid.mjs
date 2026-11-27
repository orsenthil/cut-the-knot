// Euclid's proof: visit the two configurations the page points out.
// This is an illustration, so there is no win or loss; the screenshots show
// the corner view and the fold-in view in both themes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euclid
export default async ({ page, first, log, shot, text }) => {
  log("initial:", await text("#status"));
  await shot("start");

  // The page's first suggestive picture: the point at the right-angle corner.
  await page.click("#cornerBtn");
  log("at the corner:", await text("#status"));
  await shot("corner");

  if (first) {
    // Two arrow-key moves only; focus must stay on the board afterwards.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    log("after two arrow keys:", await text("#status"));
    log("focus after keyboard:", await page.evaluate(() =>
      document.activeElement && document.activeElement.getAttribute("aria-label")));
  }

  // The page's second picture, pointed out by Scott Brodie: fold in the small
  // triangles. The applet's fallback screenshot reads 7020, 1800, 8820.
  await page.click("#foldBtn");
  log("fold in:", await text("#status"));
  await shot("fold");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
