// Latin squares demo: swap two cells, cycle a row, switch mode and restore.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs latin-squares

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  if (first) {
    await page.locator(".grid-row").first().locator(".cell").nth(0).click();
    await page.locator(".grid-row").first().locator(".cell").nth(1).click();
    log("after a swap:", await text("#status"));
    await shot("swap");
    await page.locator(".grid-row").first().locator(".row-controls button").last().click();
    log("after cycling:", await text("#status"));
    await shot("cycle");
  }

  await page.click("#restoreBtn");
  log("after restore:", await text("#status"));
  await shot("restore");

  await page.uncheck("#symCheck");
  log("plain mode:", await text("#status"));
  await shot("plain");
};
