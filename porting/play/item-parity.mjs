// Item parity demo: swap cells in both rows, change the column count and
// randomise.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs item-parity

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"), "|", await text("#readout"));
  await shot("start");

  if (first) {
    await page.locator('.cell[data-key="0,0"]').click();
    await page.locator('.cell[data-key="0,1"]').click();
    log("after a swap:", await text("#status"), "|", await text("#readout"));
    log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("data-key")));
    await shot("swap");
  }

  await page.fill("#colsInput", "12");
  await page.locator("#colsInput").dispatchEvent("input");
  log("with 12 columns:", await text("#readout"));
  await shot("twelve");

  await page.click("#randomBtn");
  log("after randomising:", await text("#status"), "|", await text("#readout"));
  await shot("random");
};
