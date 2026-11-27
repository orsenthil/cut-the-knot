// David Radcliffe is an illustration, so there is no win or loss to play.
// The scenario visits two configurations and records what each one shows:
// the default four sides and the largest setting, thirty sides.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs david-radcliffe
export default async ({ page, first, log, shot, text }) => {
  log("four sides:", await text("#status"));
  await page.locator("#board .geom-handle").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const stillFocused = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("geom-handle"));
  log("focus stays on the turning dot after keyboard turns:", stillFocused);
  await page.click("#checkBtn");
  log("checked four sides:", await text("#status"));
  await shot("four-sides");
  if (!first) return; // the dark run only needs the same screenshot

  await page.locator("#nInput").fill("30");
  await page.locator("#nInput").press("Tab");
  log("thirty sides:", await text("#status"));
  await page.click("#resetBtn");
  await page.click("#moreBtn");
  await page.locator("#nInput").fill("30");
  await page.locator("#nInput").press("Tab");
  await page.click("#checkBtn");
  log("checked thirty sides:", await text("#status"));
  await shot("thirty-sides");
};
