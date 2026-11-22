// Counting Primes: count view, error view, the biggest range.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs prime-counting
const setRange = (page, v) => page.locator("#e").evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("count");
  await setRange(page, 6);
  await page.check("#viewError");
  log("error view at a million:", await text("#readout"));
  await shot("error");
  if (!first) return;
  await page.check("#gaussCheck");
  await shot("with-gauss");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
