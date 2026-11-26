// Signs in a Matrix: flip negative sums until solved (a win), flip a
// positive one, keyboard, 15 x 15, 1 x 1.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs switching-signs
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  for (let k = 0; k < 200; k++) {
    const neg = page.locator("#grid button.sum.neg").first();
    if (!(await neg.count())) break;
    await neg.click();
  }
  log("after flipping negatives:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("solved");
  if (!first) return;
  await page.click('#grid [data-row="0"]');
  log("a positive row flipped:", await text("#status"));
  await page.focus('#grid [data-col="1"]');
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  log("column 2 twice by keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await page.fill("#rowsIn", "15"); await page.fill("#colsIn", "15"); await page.dispatchEvent("#colsIn", "change");
  log("15 x 15:", await text("#status"));
  await shot("big");
  await page.fill("#rowsIn", "0"); await page.fill("#colsIn", "0"); await page.click("#resetBtn");
  log("held to 1 x 1:", await page.inputValue("#rowsIn"), await page.inputValue("#colsIn"), "|", await text("#status"));
};
