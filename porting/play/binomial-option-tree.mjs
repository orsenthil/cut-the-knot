// Binomial Option Tree: 3 steps, then 8, then an American put at 10%.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs binomial-option-tree
export default async ({ page, first, log, shot, text }) => {
  log("3 steps:", await text("#facts"));
  await page.selectOption("#nIn", "8");
  log("8 steps:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("eight");
  if (!first) return;
  await page.selectOption("#typeIn", "put");
  await page.check("#amIn");
  await page.fill("#rIn", "0.1"); await page.dispatchEvent("#rIn", "input");
  await page.selectOption("#nIn", "4");
  log("American put:", await text("#facts"));
  await shot("put");
};
