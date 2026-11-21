// Sums and products invariant demo: merge pairs to the end, use Repeat,
// change count and max, and start fresh.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sums-products-invariant

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#prediction"));
  await shot("start");

  if (first) {
    while (await page.locator(".number").count() > 1) {
      await page.locator(".number").first().click();
      await page.locator(".number").last().click();
    }
    log("finished:", await text("#status"));
    log("prediction:", await text("#prediction"));
    await shot("finished");

    await page.click("#repeatBtn");
    log("after Repeat:", await text("#status"));
    await shot("repeat");
  }

  await page.fill("#countInput", "3");
  await page.locator("#countInput").dispatchEvent("input");
  await page.fill("#maxInput", "5");
  await page.locator("#maxInput").dispatchEvent("input");
  log("after settings:", await text("#prediction"));
  await shot("settings");
};
