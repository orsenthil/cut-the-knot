// Nine Squares: a wrong a (gaps and overlaps), then the one where they fit.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs nine-squares
export default async ({ page, first, log, shot, text }) => {
  await page.fill("#aIn", "6");
  await page.dispatchEvent("#aIn", "input");
  log("a = 6:", await text("#readout"));
  await shot("not-fitting");
  await page.click("#nineBtn");
  log("a = 9:", await text("#status"));
  await shot("perfect");
};
