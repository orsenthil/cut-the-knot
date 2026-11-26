// The Black-Scholes Formula: defaults, simulate, a far strike with high volatility.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs black-scholes-formula
export default async ({ page, first, log, shot, text }) => {
  log("defaults:", await text("#prices"));
  await page.click("#simBtn");
  log("simulate:", (await text("#mc")).replace(/\s+/g, " "), "| class:", await page.getAttribute("#status", "class"));
  await shot("sim");
  if (!first) return;
  await page.fill("#KIn", "140"); await page.dispatchEvent("#KIn", "input");
  await page.fill("#sigmaIn", "0.6"); await page.dispatchEvent("#sigmaIn", "input");
  log("far strike, 60%:", await text("#prices"));
  await shot("far");
};
