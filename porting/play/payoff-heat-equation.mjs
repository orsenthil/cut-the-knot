// From Payoff to Heat Equation: no time left, then a year, then high volatility.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs payoff-heat-equation
export default async ({ page, first, log, shot, text }) => {
  await page.fill("#tauIn", "0"); await page.dispatchEvent("#tauIn", "input");
  log("no time:", await text("#facts"));
  await page.fill("#tauIn", "1"); await page.dispatchEvent("#tauIn", "input");
  log("a year:", await text("#facts"), "| class:", await page.getAttribute("#status", "class"));
  await shot("year");
  if (!first) return;
  await page.fill("#sigmaIn", "0.6"); await page.dispatchEvent("#sigmaIn", "input");
  log("60% volatility:", await text("#facts"));
  await shot("wild");
};
