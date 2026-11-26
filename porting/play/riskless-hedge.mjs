// The Riskless Hedge: the article's call (a win), a wrong price, the put
// with a short hedge, the chance slider.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs riskless-hedge
export default async ({ page, first, log, shot, text }) => {
  for (let k = 0; k < 10; k++) await page.click("#moreBtn");
  log("half a share:", await text("#status"));
  await page.fill("#guessIn", "5"); await page.click("#guessBtn");
  log("price 5:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("article");
  if (!first) return;
  await page.selectOption("#puzzleIn", "put");
  await page.fill("#guessIn", "12"); await page.click("#guessBtn");
  for (let k = 0; k < 10; k++) await page.click("#lessBtn");
  log("put hedge, wrong price:", await text("#status"));
  await page.fill("#guessIn", "10"); await page.click("#guessBtn");
  log("put price 10:", await text("#status"));
  await page.fill("#chanceIn", "0.9"); await page.dispatchEvent("#chanceIn", "input");
  log("chance 90%:", await text("#chanceOut"));
  await shot("put");
};
