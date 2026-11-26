// Group Multiplication of Permutations: lists, then cycles at the largest N.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs perm-group
export default async ({ page, first, log, shot, text }) => {
  log("lists:", await text("#status"));
  await shot("lists");
  if (!first) return;
  await page.check("#cycIn");
  await page.fill("#nIn", "20");
  await page.dispatchEvent("#nIn", "change");
  log("cycles N=20:", await text("#status"));
  await shot("cycles");
};
