// ISBN encoding demo: cycle a digit, break the format, then reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs isbn-encoding

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("EAN:", await text("#eanText"), "| modules:", await page.locator(".module").count());
  await shot("start");

  if (first) {
    await page.locator(".isbn-cell").first().click();
    log("after cycling a digit:", await text("#status"));
    log("EAN:", await text("#eanText"));
    await shot("cycled");
    await page.locator(".isbn-cell").nth(1).click();
    log("after breaking the format:", await text("#status"));
    await shot("invalid");
  }

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  await shot("reset");
};
