// Other Primes: pick a cell, switch to x, make the table biggest.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs other-primes
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await page.click("#grid .cell:nth-child(13)");
  log("picked:", await text("#readout"));
  await shot("pick");
  await page.check("#showX");
  log("x view:", await text("#status"));
  if (!first) return;
  await page.fill("#dim", "30");
  await page.locator("#dim").press("Enter");
  await page.check("#showN");
  log("30 x 30:", await text("#readout"));
  await shot("big");
};
