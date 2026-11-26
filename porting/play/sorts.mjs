// Sorting Algorithms: run each method on the same array, step, stop, sizes,
// kinds of arrays, circles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sorts
export default async ({ page, first, log, shot, text }) => {
  await page.check("#sameBox");
  for (let m = 0; m < 5; m++) {
    await page.selectOption("#methodSel", String(m));
    await page.click("#runBtn");
    await page.waitForFunction(() => document.getElementById("status").classList.contains("done"), null, { timeout: 20000 });
    log(await text("#status"));
  }
  await shot("sorted");
  if (!first) return;
  await page.uncheck("#sameBox");
  await page.selectOption("#orderSel", "2");
  await page.selectOption("#methodSel", "0");
  for (let i = 0; i < 5; i++) await page.click("#stepBtn");
  log("five steps on descending:", await text("#counts"), "|", await text("#status"));
  await page.click("#runBtn");
  await page.waitForTimeout(200);
  await page.click("#runBtn");
  log("stopped:", await text("#counts"), "|", await text("#status"));
  await page.fill("#sizeIn", "100"); await page.dispatchEvent("#sizeIn", "change");
  await page.check('input[value="circles"]');
  await page.selectOption("#orderSel", "4");
  await page.selectOption("#methodSel", "3");
  await page.focus("#runBtn");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  log("100 convex, shellsort, stopped by keyboard:", await text("#counts"), "|", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await shot("circles");
  await page.fill("#sizeIn", "1"); await page.dispatchEvent("#sizeIn", "change");
  log("size below range:", await page.inputValue("#sizeIn"));
};
