// Sums of Two Squares: 25, then jump through the records.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sums-of-two-squares
export default async ({ page, first, log, shot, text }) => {
  log("start:", (await text("#readout")).split("\n").slice(0, 2).join(" | "));
  await shot("25");
  await page.click("#nextBtn");
  log("next record:", (await text("#readout")).split("\n").slice(0, 2).join(" | "), "|", await text("#status"));
  await shot("65");
  if (!first) return;
  await page.click("#nextBtn"); await page.click("#nextBtn");
  log("two more:", (await text("#readout")).split("\n").slice(0, 2).join(" | "));
  await page.click("#resetBtn");
  log("after reset:", (await text("#readout")).split("\n")[0]);
};
