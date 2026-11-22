// The Basel Problem: ten terms, a thousand, a hundred thousand.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs basel-problem
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("ten");
  await setRange(page, "#e", 3);
  log("a thousand:", await text("#readout"));
  await shot("thousand");
  if (!first) return;
  await setRange(page, "#e", 5);
  log("a hundred thousand:", await text("#readout"));
  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
};
