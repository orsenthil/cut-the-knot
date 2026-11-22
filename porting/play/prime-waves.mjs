// Primes from the Zeros: add zeros, flatten, the full set.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs prime-waves
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await setRange(page, "#k", 10);
  log("ten zeros:", await text("#readout"));
  await shot("ten");
  await setRange(page, "#k", 100);
  log("all zeros:", await text("#status"));
  await shot("all");
  if (!first) return;
  await page.check("#flat");
  await setRange(page, "#xmax", 200);
  await shot("flat");
  await page.click("#resetBtn");
  await page.click("#playBtn");
  await page.waitForTimeout(700);
  await page.click("#playBtn");
  log("after a short play:", await text("#readout"));
};
