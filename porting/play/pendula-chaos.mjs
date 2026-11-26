// Pendula chaos: run forwards a moment, then stop, then the most dots running backwards.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs pendula-chaos
export default async ({ page, first, log, shot, idle, text }) => {
  await shot("start");
  await page.click("#fwdBtn");
  await page.waitForTimeout(700);
  await page.click("#stopBtn");
  log("after a moment:", await text("#status"));
  await shot("running");
  if (!first) return;
  await page.fill("#nIn", "100");
  await page.dispatchEvent("#nIn", "change");
  await page.click("#backBtn");
  await page.waitForTimeout(500);
  await shot("hundred");
};
