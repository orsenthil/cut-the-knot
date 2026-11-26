// Zeros and Nines: edit the blue number, then check a column twice (with
// and without autonomous digits) and look at the largest options.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs zeros-and-nines
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  // The right half of a blue digit increases it, the left half decreases it.
  // The units digit may be off-screen at 375px, so bring it into view first.
  const digit = page.locator("button.digit[data-index='0']");
  await digit.scrollIntoViewIfNeeded();
  const box = await digit.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  log("after clicking the right half of the units digit:", await text("#table"));
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
  log("after clicking the left half again:", await text("#table"));

  // Keyboard: the focus stays on the digit after the table is redrawn.
  await page.focus("button.digit[data-index='0']");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(() => document.activeElement?.dataset?.index ?? null);
  log("after ArrowUp, focus index:", focus, "|", await text("#status"));

  await page.click("#checkBtn");
  log("after checking a column:", await text("#status"));
  await shot("checked");

  if (!first) return; // the dark run only needs the screenshot above

  await page.fill("#digitsIn", "4");
  await page.dispatchEvent("#digitsIn", "change");
  await page.fill("#baseIn", "10");
  await page.dispatchEvent("#baseIn", "change");
  await page.check("#autoIn");
  await page.check("#colsIn");
  await page.click("button.colBtn[data-col='2']");
  log("autonomous digits, column 2:", await text("#status"));

  await page.uncheck("#autoIn");
  await page.fill("#colIn", "1");
  await page.click("#checkBtn");
  log("connected digits, column 1:", await text("#status"));

  // Largest options: the wide table must scroll inside .stage, not the page.
  await page.fill("#baseIn", "36");
  await page.dispatchEvent("#baseIn", "change");
  await page.fill("#digitsIn", "18");
  await page.dispatchEvent("#digitsIn", "change");
  await page.click("#newBtn");
  await page.click("#checkBtn");
  log("base 36, 18 digits:", await text("#status"));
  log("page overflow:", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await shot("wide");
};
