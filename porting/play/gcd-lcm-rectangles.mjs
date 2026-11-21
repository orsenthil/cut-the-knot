// GCD x LCM rectangles demo: change both numbers in both directions, including
// extremes, and check the identity stays visible.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gcd-lcm-rectangles

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text(".identity"));
  await shot("start");

  if (first) {
    await page.fill("#mInput", "12");
    await page.locator("#mInput").press("Enter");
    await page.fill("#nInput", "10");
    await page.locator("#nInput").press("Enter");
    log("after keyboard edits:", await text(".identity"));
    log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
    await shot("keyboard");
  }

  await page.fill("#mInput", "40");
  await page.locator("#mInput").press("Enter");
  await page.fill("#nInput", "1");
  await page.locator("#nInput").press("Enter");
  log("at the range extremes:", await text(".identity"));
  await shot("extremes");
};
