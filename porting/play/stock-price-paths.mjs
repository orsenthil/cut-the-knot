// Stock Price Paths: new paths, high volatility, 1000 paths.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs stock-price-paths
export default async ({ page, first, log, shot, text }) => {
  await page.click("#newBtn");
  log("new paths:", await text("#status"), "|", await text("#stats"));
  await shot("paths");
  if (!first) return;
  await page.fill("#muIn", "0"); await page.dispatchEvent("#muIn", "input");
  await page.fill("#sigmaIn", "0.8"); await page.dispatchEvent("#sigmaIn", "input");
  await page.selectOption("#countIn", "1000");
  log("wild:", await text("#status"), "|", await text("#stats"));
  await shot("wild");
};
