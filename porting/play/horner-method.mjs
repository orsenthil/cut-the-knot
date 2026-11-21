// Horner's method demo: edit a coefficient and x, then check the summary.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs horner-method

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("summary:", await page.locator(".horner-summary p").textContent());
  await shot("start");

  if (first) {
    const input = page.locator('input[data-part="coefficient"][data-index="0"]');
    await input.fill("3");
    await input.press("Enter");
    log("after editing a coefficient:", await page.locator(".horner-summary p").textContent());
    await shot("coefficient");
  }
  await page.fill("#tInput", "3");
  await page.locator("#tInput").press("Enter");
  log("at x = 3:", await page.locator(".horner-summary p").textContent());
  log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  await shot("x3");
};
