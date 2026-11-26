// Product of Permutations: swap two numbers in f, then the largest circles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs perm-product
export default async ({ page, first, log, shot, text }) => {
  await page.click("#svgF circle.node >> nth=0");
  await page.click("#svgF circle.node >> nth=2");
  log("after a swap:", await text("#cycP"));
  await shot("swap");
  if (!first) return;
  await page.fill("#nIn", "20");
  await page.dispatchEvent("#nIn", "change");
  log("N=20:", await text("#cycP"));
  await shot("twenty");
};
