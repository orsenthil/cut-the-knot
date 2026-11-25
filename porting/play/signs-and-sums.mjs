// Signs and Sums: choose a length that allows it and show a solution, then one that does not.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs signs-and-sums
export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#lengthSel", "8");
  await page.click("#showBtn");
  log("after a solution for length 8:", await text("#status"));
  await shot("win");
  if (!first) return;

  await page.selectOption("#lengthSel", "9");
  await page.click("#showBtn");
  log("after length 9:", await text("#status"));
  await shot("loss");
};
