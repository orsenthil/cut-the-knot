// Ryser's Formula: step through the 3 x 3, show all on a 4 x 4.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ryser-formula
export default async ({ page, first, log, shot, text }) => {
  for (let k = 0; k < 4; k++) await page.click("#nextBtn");
  log("4 terms:", await text("#status"));
  await shot("steps");
  if (!first) return;
  await page.click("#allBtn");
  log("3 x 3 done:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await page.selectOption("#sizeIn", "4");
  await page.click("#allBtn");
  log("4 x 4:", await text("#status"), "|", await text("#total"));
  await shot("four");
};
