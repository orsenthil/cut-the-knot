// Flipping items simultaneously III: turn every circle blue with the fewest clicks, then an impossible pair.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs flip-them-iii
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.dataset.i !== undefined ? "circle " + a.dataset.i : a.id); });
  const blueCount = () => page.locator("#ring g.disc.blue").count();
  const disc = (i) => page.locator(`#ring g.disc[data-i="${i}"]`);
  log("initial:", await text("#info"));
  await shot("initial");
  await page.check("#answerBox");
  log("answer for 12 and 3:", await text("#answer"));
  await page.fill("#nIn", "24"); await page.press("#nIn", "Tab"); await page.fill("#mIn", "12"); await page.press("#mIn", "Tab");
  log("N = 24, M = 12:", await text("#answer"));
  await shot("max-options");
  await page.fill("#mIn", "3"); await page.press("#mIn", "Tab"); await page.fill("#nIn", "12"); await page.press("#nIn", "Tab");
  for (const i of [0, 3, 6, 9]) await disc(i).click({ force: true });
  log("four clicks, every third circle:", await text("#status"), "| result =", await kind());
  await shot("win");
  if (!first) return;
  await page.click("#resetBtn");
  await page.fill("#mIn", "4"); await page.press("#mIn", "Tab");
  log("N = 12, M = 4 (M1 = 1):", await text("#answer"));
  await page.fill("#mIn", "8"); await page.press("#mIn", "Tab");
  log("N = 12, M = 8 (M1 = 2):", await text("#answer"), "| solution button enabled =", await page.locator("#solveBtn").isEnabled());
  await page.fill("#mIn", "5"); await page.press("#mIn", "Tab");
  log("N = 12, M = 5:", await text("#answer"));
  await page.click("#solveBtn");
  await page.waitForFunction(() => document.getElementById("status").classList.contains("win"), null, { timeout: 20000 });
  log("Show a solution:", await text("#status"), "| blue =", await blueCount(), "| result =", await kind());
  await shot("solution");
  await page.click("#resetBtn");
  await disc(0).focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard: moved on and clicked, focus =", await focus(), "|", await text("#info"));
  await page.fill("#nIn", "30"); await page.press("#nIn", "Tab");
  log("N typed 30:", await text("#status"), "|", await page.inputValue("#nIn"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#info"));
  await shot("reset");
};
