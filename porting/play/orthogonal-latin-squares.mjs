// Orthogonal Latin Squares: show a solution, break it with a swap, repair it, then size 6.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs orthogonal-latin-squares
export default async ({ page, first, log, shot, text }) => {
  await page.fill("#nIn", "5");
  await page.dispatchEvent("#nIn", "change");
  await page.click("#showBtn");
  log("a solution for 5:", await text("#status"));
  await shot("win");
  if (!first) return;
  // break it: swap two small letters in the first row, then swap them back
  await page.locator("#grid button.cell").nth(0).click();
  await page.locator("#grid button.cell").nth(1).click();
  log("after one swap:", await text("#checks"));
  await shot("broken");
  await page.locator("#grid button.cell").nth(0).click();
  await page.locator("#grid button.cell").nth(1).click();
  log("swapped back:", await text("#status"));
  await page.fill("#nIn", "6");
  await page.dispatchEvent("#nIn", "change");
  log("size 6:", await text("#status"));
  await page.click("#showBtn");
  log("show for 6:", await text("#status"));
  await shot("six");
};
