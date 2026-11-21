// Flipping items simultaneously II: the impossible puzzle (12, 3) with the helper, then a solvable one, solved by hand and by Show a solution.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs flip-them-ii
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.dataset.i !== undefined ? "circle " + a.dataset.i : a.id); });
  const blue = () => page.evaluate(() => [...document.querySelectorAll("#ring g.disc")].map((g, i) => (g.classList.contains("blue") ? i + 1 : 0)).filter(Boolean).join(","));
  const disc = (i) => page.locator(`#ring g.disc[data-i="${i}"]`);
  log("initial:", await text("#info"), "| blue =", await blue(), "| solution available =", await page.locator("#solveBtn").isEnabled());
  await shot("initial");
  await page.check("#helperBox");
  log("helper on:", await text("#status"));
  await shot("max-options");
  await disc(0).click({ force: true }); await disc(3).click({ force: true }); await disc(6).click({ force: true });
  log("three clicks on the 12-ring, M = 3:", await blue(), "| result =", await kind());
  await page.uncheck("#helperBox");
  await page.fill("#nIn", "7"); await page.press("#nIn", "Tab");
  log("N = 7, M = 3:", await text("#info"), "| solution available =", await page.locator("#solveBtn").isEnabled());
  await page.click("#solveBtn");
  await page.waitForFunction(() => document.getElementById("status").classList.contains("win"), null, { timeout: 15000 });
  log("Show a solution:", await text("#status"), "| result =", await kind());
  await shot("win");
  if (!first) return;
  await page.click("#resetBtn");
  await page.fill("#mIn", "4"); await page.press("#mIn", "Tab");
  log("N = 7, M = 4:", await text("#info"), "| solution available =", await page.locator("#solveBtn").isEnabled());
  await page.fill("#nIn", "12"); await page.press("#nIn", "Tab"); await page.fill("#mIn", "5"); await page.press("#mIn", "Tab");
  log("N = 12, M = 5 (not a divisor): helper enabled =", await page.locator("#helperBox").isEnabled(), "| solution available =", await page.locator("#solveBtn").isEnabled());
  await disc(0).focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard: moved on and clicked, focus =", await focus(), "| blue =", await blue());
  await page.fill("#nIn", "30"); await page.press("#nIn", "Tab");
  log("N typed 30:", await text("#status"), "|", await page.inputValue("#nIn"));
  await page.fill("#mIn", "13"); await page.press("#mIn", "Tab");
  log("M typed 13:", await text("#status"), "|", await page.inputValue("#mIn"));
  await page.click("#resetBtn");
  log("after Reset:", await blue());
  await shot("reset");
};
