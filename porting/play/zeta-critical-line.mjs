// The zeta function on the critical line: next zero, a step off the line, the walk.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs zeta-critical-line
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await page.click("#nextBtn");
  log("first zero:", await text("#status"));
  await shot("zero");
  await setRange(page, "#sigma", 0.4);
  log("off the line:", await text("#status"));
  await shot("off-line");
  if (!first) return;
  await page.click("#resetBtn");
  await page.click("#walkBtn");
  await page.waitForTimeout(600);
  await page.click("#walkBtn");
  log("after a short walk:", await text("#readout"));
  await page.click("#nextBtn");
  await page.click("#nextBtn");
  log("second zero:", await text("#readout"));
};
