// Generalized item parity demo: swap cells, vary both sliders, randomise.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs item-parity-generalized

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("start");

  if (first) {
    await page.locator('.cell[data-key="0,0"]').click();
    await page.locator('.cell[data-key="0,1"]').click();
    log("after a swap:", await text("#status"));
    await shot("swap");
  }

  await page.fill("#redsInput", "5");
  await page.locator("#redsInput").dispatchEvent("input");
  log("five reds on top:", await text("#readout"));
  log("status:", await text("#status"));
  await shot("reds");

  await page.fill("#colsInput", "11");
  await page.locator("#colsInput").dispatchEvent("input");
  log("eleven columns:", await text("#readout"));
  await shot("odd");
};
