// Ambassadors at a round table: turn an arc by hand, then let the Hint finish.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs enemy-ambassadors
export default async ({ page, first, log, shot, text }) => {
  const isWin = () => page.evaluate(() => document.getElementById("status").classList.contains("win"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && a.dataset && a.dataset.place; });
  const place = (p) => page.locator(`#table g.place[data-place="${p}"]`);
  log("initial:", await text("#count"));
  await shot("initial");
  await page.fill("#nIn", "30"); await page.press("#nIn", "Tab");
  log("30 ambassadors:", await text("#count"));
  await shot("max-options");
  await page.fill("#nIn", "10"); await page.press("#nIn", "Tab");
  await place(2).click(); await place(6).click();
  log("turned the arc 3..7:", await text("#status"), "|", await text("#count"));
  await shot("explored");
  if (!first) return;
  // keyboard: Enter on two places, with the arrows between them
  await place(0).focus();
  await page.keyboard.press("Enter"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("two turns by keyboard, focus on place", await focus(), "|", await text("#count"));
  // the hint until done (or until it says it cannot)
  for (let k = 0; k < 40 && !(await isWin()); k++) { await page.click("#hintBtn"); const t = await text("#status"); if (/needs everyone|No hostile/.test(t)) { log("hint stops:", t); break; } }
  log("after the hint:", await text("#status"), "| win =", await isWin());
  await shot("finished");
  await page.fill("#nIn", "40"); await page.press("#nIn", "Tab");
  log("N typed 40:", await text("#status"), "|", await page.inputValue("#nIn"));
  await page.click("#newBtn");
  log("new enemies:", await text("#count"), "| win =", await isWin());
  await shot("reset");
};
