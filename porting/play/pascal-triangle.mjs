// Pascal's Triangle: press a middle dot, then the other two shapes with the most rows.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs pascal-triangle
export default async ({ page, first, log, shot, text }) => {
  await page.click('#board circle[aria-label="Row 5, place 2: 10 ways"]');
  log("sum:", await text("#readout"));
  await shot("sum");
  if (!first) return;
  await page.fill("#rowsIn", "16");
  await page.dispatchEvent("#rowsIn", "input");
  await page.selectOption("#formSel", "pascals");
  await page.check("#arrowsIn");
  log("big:", await text("#readout"));
  await shot("pascals");
  await page.selectOption("#formSel", "right");
  await shot("right");
};
