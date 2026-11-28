// Half Turn: two configurations of the demonstration, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs half-turn
export default async ({ page, first, log, shot, text }) => {
  // Even number of half turns: a pure translation, with names and the long
  // AA_n and BB_n guide lines on.
  await page.selectOption("#nSel", "4");
  await page.check("#namesBox");
  await page.check("#statementBox");
  log("4 half turns:", await text("#status"));
  await shot("even");

  if (!first) return; // the dark run only needs the screenshot above

  // Odd number: reset, flip five times, then move a center using the keyboard
  // alone and check that focus stays on it after the redraw.
  await page.click("#resetBtn");
  await page.selectOption("#nSel", "5");
  const handles = page.locator('#board circle[role="button"]');
  const center = handles.nth(2); // A, B, then O1
  await center.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  log("focus after keyboard moves:", focused);
  if (!/Center O1/.test(focused)) throw new Error("focus left the center after a keyboard move");
  log("5 half turns:", await text("#status"));
  await shot("odd");

  await page.click("#centersBtn");
  log("after New centers:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
