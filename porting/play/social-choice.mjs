// Social Choice: tick every method, swap and reverse, change voters,
// choices and ballots to their ends, the four-winners example, reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs social-choice
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  for (const m of [1, 2, 3, 4]) await page.check(`input[data-method="${m}"]`);
  log("all methods:", await text("#status"));
  await shot("methods");
  if (!first) return;
  await page.click('[data-ballot="2"][data-index="1"]');
  log("ballot 3 B above C:", await text("#status"));
  await page.click("#backBtn");
  log("reverse swap:", await text("#status"));
  await page.focus('[data-count="1"][data-d="1"]');
  await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
  log("3 more BCA voters by keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await page.click("#exampleBtn");
  log("four winners:", await text("#status"));
  await shot("four-winners");
  for (let i = 0; i < 10; i++) { await page.click("#ncMore"); await page.click("#nsMore"); }
  log("10 choices, 10 ballots:", await text("#ncOut"), await text("#nsOut"));
  await shot("largest");
  for (let i = 0; i < 10; i++) { await page.click("#ncLess"); await page.click("#nsLess"); }
  log("2 and 2:", await text("#ncOut"), await text("#nsOut"), "|", await text("#status"));
  await page.uncheck('input[data-method="3"]');
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
