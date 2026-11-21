// The Futurama theorem game: refused swaps, a take-back, and the solution playing out.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs futurama
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.dataset.i !== undefined ? "body " + a.dataset.i : a.id); });
  const body = (i) => page.locator(`#ring g.body[data-i="${i}"]`);
  const homes = () => page.locator("#ring g.home").count();
  log("initial:", await text("#log"), "| at home =", await homes());
  await shot("initial");
  await page.fill("#nIn", "12"); await page.press("#nIn", "Tab");
  log("12 people:", await homes(), "at home | solution button enabled =", await page.locator("#solveBtn").isEnabled());
  await shot("max-options");
  await page.fill("#nIn", "4"); await page.press("#nIn", "Tab");
  await body(0).click({ force: true }); await body(1).click({ force: true });
  log("two ordinary bodies:", await text("#status"));
  await body(0).click({ force: true }); await body(4).click({ force: true });
  log("a swap with X:", await text("#log"));
  await body(4).click({ force: true }); await body(0).click({ force: true });
  log("the same pair again:", await text("#status"));
  await page.click("#backBtn");
  log("after Take back:", await text("#log"));
  await page.click("#solveBtn");
  await page.waitForFunction(() => document.getElementById("status").classList.contains("win"), null, { timeout: 25000 });
  log("Show a solution:", await text("#status"), "| result =", await kind(), "|", await homes(), "at home");
  await shot("win");
  if (!first) return;
  await page.click("#resetBtn");
  await body(0).focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard: selected a body, focus =", await focus(), "|", await text("#status"));
  await page.keyboard.press("Enter");
  log("pressed it again:", await text("#status"));
  await page.fill("#nIn", "13"); await page.press("#nIn", "Tab");
  log("people typed 13:", await text("#status"), "|", await page.inputValue("#nIn"));
  await shot("reset");
};
