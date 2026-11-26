// Base tables: + in base 10, x in base 16, click a cell, keyboard, base 2
// and 36.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs base-tables
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await page.check('input[value="x"]');
  await page.fill("#radixIn", "16"); await page.dispatchEvent("#radixIn", "change");
  await page.click('#table td[data-a="15"][data-b="7"]');
  log("F x 7 in base 16:", await text("#status"));
  await shot("hex");
  if (!first) return;
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("by keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.a + "," + document.activeElement.dataset.b));
  await page.fill("#radixIn", "36"); await page.dispatchEvent("#radixIn", "change");
  log("base 36:", await text("#status"));
  await shot("base36");
  await page.fill("#radixIn", "1"); await page.dispatchEvent("#radixIn", "change");
  await page.check('input[value="+"]');
  log("held to base 2:", await page.inputValue("#radixIn"), "|", await text("#status"));
};
