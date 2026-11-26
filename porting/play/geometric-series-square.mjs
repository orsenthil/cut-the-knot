// Geometric Series in a Square: cut each picture several times, push N to
// 20, step back, switch pictures and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs geometric-series-square
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  for (let i = 0; i < 4; i++) await page.click("#moreBtn");
  log("halves, N=5:", await text("#status"));
  await shot("halves");
  if (!first) return;
  await page.check('input[value="3"]');
  log("thirds reset to N:", await text("#nValue"), "|", await text("#status"));
  for (let i = 0; i < 3; i++) await page.click("#moreBtn");
  log("thirds, N=4:", await text("#status"));
  await shot("thirds");
  for (let i = 0; i < 20; i++) if (!(await page.isDisabled("#moreBtn"))) await page.click("#moreBtn");
  log("thirds, N=20:", await text("#status"), "|", await text("#note"));
  await shot("thirds-max");
  await page.check('input[value="4"]');
  await page.focus("#moreBtn");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
  log("quarters by keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.click("#lessBtn");
  log("one back:", await text("#status"));
  await page.click("#resetBtn");
  log("reset:", await text("#nValue"), "|", await text("#status"), "| less disabled:", await page.isDisabled("#lessBtn"));
  await shot("final");
};
