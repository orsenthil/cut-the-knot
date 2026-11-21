// Logistic model demo: try a fixed point, a cycle and chaos, then sweep.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs logistic-model

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("start");

  await page.fill("#rInput", "2");
  await page.locator("#rInput").dispatchEvent("input");
  log("r = 2:", await text("#status"));
  await shot("fixed");

  if (first) {
    await page.fill("#rInput", "4");
    await page.locator("#rInput").dispatchEvent("input");
    log("r = 4:", await text("#status"));
    await shot("chaos");
  }

  await page.click("#sweepBtn");
  await page.waitForTimeout(400);
  await page.click("#sweepBtn");
  log("after a sweep:", await text("#readout"));
  await shot("sweep");
};
