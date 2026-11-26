// Distance Between Strings: H and L of the page's example, different
// lengths, case, the table, the keyboard, a clear.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs string-distance
export default async ({ page, first, log, shot, text }) => {
  await page.click("#doBtn");
  log("Hamming:", await text("#status"));
  await page.check('input[value="levenshtein"]');
  await page.click("#doBtn");
  log("Levenshtein:", await text("#status"), "|", await text("#table .edits"));
  await shot("table");
  if (!first) return;
  await page.check('input[value="hamming"]');
  await page.fill("#sIn", "kitten"); await page.fill("#tIn", "sitting");
  await page.click("#doBtn");
  log("different lengths:", await text("#status"));
  await page.check('input[value="levenshtein"]');
  await page.focus("#tIn");
  await page.keyboard.press("Enter");
  log("by Enter:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.fill("#sIn", "ABC"); await page.fill("#tIn", "abc");
  await page.check("#caseBox");
  await page.click("#doBtn");
  log("case sensitive:", await text("#status"));
  await page.fill("#sIn", "the quick brown fox jumps"); await page.fill("#tIn", "a quick brown dog jumped over");
  await page.click("#doBtn");
  log("long:", await text("#status"));
  await shot("long");
  await page.click("#clearBtn");
  log("cleared:", await text("#list"), "|", await text("#status"));
};
