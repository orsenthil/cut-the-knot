// Kaprekar demo: run the default, step a new start, change base and padding.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs kaprekar-routine

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"), "| rows:", await page.locator(".kap-table tr").count());
  await shot("start");

  await page.click("#runBtn");
  log("after Run:", await text("#status"), "| rows:", await page.locator(".kap-table tr").count());
  await shot("run");

  if (first) {
    await page.fill("#startInput", "1121");
    await page.locator("#startInput").press("Enter");
    await page.uncheck("#paddedCheck");
    await page.click("#runBtn");
    log("without padding:", await text("#status"));
    await shot("no-padding");
    await page.check("#paddedCheck");
    await page.click("#runBtn");
    log("with padding:", await text("#status"));
    await shot("padding");
  }

  await page.selectOption("#widthSel", "3");
  await page.fill("#startInput", "123");
  await page.locator("#startInput").press("Enter");
  await page.click("#runBtn");
  log("three digits:", await text("#status"));
  await shot("three");
};
