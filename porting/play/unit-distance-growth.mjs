// How Fast Do Unit Distances Grow?: 16 by 16, 36 by 36 (the article's example), then 64.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs unit-distance-growth
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", (await text("#readout")).split("\n")[0]);
  await setRange(page, "#k", 36);
  log("36 x 36:", (await text("#readout")).split("\n")[0]);
  await shot("36");
  await setRange(page, "#k", 64);
  log("64 x 64:", (await text("#readout")).split("\n")[1], "|", await text("#status"));
  await shot("64");
  if (!first) return;
  await page.click("#resetBtn");
  log("after reset:", (await text("#readout")).split("\n")[0]);
};
