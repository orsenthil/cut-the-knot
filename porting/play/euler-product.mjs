// Euler's Product: move s and n, then try s = 1 where nothing converges.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-product
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await page.fill("#n", "300").catch(() => {});
  await page.locator("#n").evaluate((el) => { el.value = 300; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("n = 300:", await text("#readout"));
  await shot("converging");
  await page.locator("#s").evaluate((el) => { el.value = 1; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("s = 1:", await text("#status"));
  await shot("diverging");
  if (!first) return;
  await page.locator("#n").evaluate((el) => { el.value = 2000; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("s = 1, n = 2000:", await text("#readout"));
  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
};
