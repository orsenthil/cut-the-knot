// Filling an Array with 0s and 1s: flip a few squares, complement, then ask for the best array.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs zeros-and-ones-array
export default async ({ page, first, log, shot, text }) => {
  await page.click("#grid button >> nth=0");
  await page.click("#grid button >> nth=1");
  await page.click("#grid button >> nth=5");
  log("a few flips:", await text("#setLine"));
  await shot("flips");
  await page.fill("#nIn", "7");
  await page.dispatchEvent("#nIn", "change");
  await page.fill("#mIn", "6");
  await page.dispatchEvent("#mIn", "change");
  await page.click("#bestBtn");
  log("the most for 7 by 6:", await text("#setLine"), "|", await text("#status"));
  await shot("best");
  if (!first) return;
  await page.click("#compBtn");
  log("complement:", await text("#setLine"));
  await page.fill("#nIn", "3");
  await page.dispatchEvent("#nIn", "change");
  await page.fill("#mIn", "2");
  await page.dispatchEvent("#mIn", "change");
  await page.click("#bestBtn");
  log("3 by 2:", await text("#status"));
};
