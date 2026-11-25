// Moving Chips in Pairs: N = 4 (solvable): win with the strategy hint; then N = 6 (impossible) and a loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs moving-chips-in-pairs
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  const chips = page.locator("button.sq:not(:disabled)");
  await setRange(page, "#n", 4);
  log("N = 4:", await chips.count(), "chips to move |", await text("#status"));
  await shot("N=4 start");
  for (let guard = 0; guard < 40 && !(await page.locator("#status.win, #status.lose").count()); guard++) {
    await page.click("#hintBtn");
    const cols = (await text("#status")).match(/columns (\d+) and (\d+)/);
    if (!cols) break;
    for (const c of [cols[1], cols[2]]) await page.locator(`button.sq[data-c="${Number(c) - 1}"]`).click();
    await page.click("#moveBtn");
  }
  log("with the strategy:", await text("#status"));
  await shot("N=4 won");
  if (!first) return;
  await page.click("#undoBtn");
  log("after Remove last:", await text("#status"));
  await setRange(page, "#n", 6);
  // N = 6 can never be solved: move any two chips until blocked
  for (let guard = 0; guard < 60 && !(await page.locator("#status.win, #status.lose").count()); guard++) {
    const n = await chips.count();
    if (n < 2) break;
    await chips.nth(0).click(); await chips.nth(1).click(); await page.click("#moveBtn");
  }
  log("N = 6 ends:", await text("#status"));
  await shot("N=6 blocked");
  await setRange(page, "#n", 20);
  log("N = 20:", await page.locator(".sq").count(), "squares");
  await shot("N=20");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
