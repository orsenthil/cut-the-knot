// The Harmonic Series: more and more terms.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs harmonic-series
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("hundred");
  await setRange(page, "#e", 4);
  log("ten thousand:", await text("#readout"));
  await shot("ten-thousand");
  if (!first) return;
  await setRange(page, "#e", 6);
  log("a million:", await text("#status"));
  await shot("million");
  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
};
