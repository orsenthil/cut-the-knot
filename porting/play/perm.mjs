// Various Ways to Define a Permutation: lines with a number picked, then upside down at the largest N.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs perm
export default async ({ page, first, log, shot, text }) => {
  await page.selectOption("#viewSel", "lines");
  await page.click("#board circle.node >> nth=2");
  log("picked:", await text("#status"));
  await shot("lines");
  if (!first) return;
  await page.fill("#nIn", "20");
  await page.dispatchEvent("#nIn", "change");
  await page.selectOption("#viewSel", "upside");
  log("facts:", await text("#facts"));
  await shot("upside");
};
