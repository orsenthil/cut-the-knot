// Grid Spacing Dial: the article's 16 x 16 example, then the best dial.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs grid-spacing-dial
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", (await text("#readout")).split("\n")[1]);
  await setRange(page, "#c", 65);
  log("c2 = 65:", (await text("#readout")).split("\n")[1]);
  await shot("65");
  await page.click("#showBtn");
  log("best:", (await text("#readout")).split("\n")[1], "|", await text("#status"));
  await shot("best");
  if (!first) return;
  await page.selectOption("#k", "8");
  log("8 x 8:", (await text("#readout")).split("\n")[0]);
  await page.click("#resetBtn");
  log("after reset:", (await text("#readout")).split("\n")[1]);
};
