// Hummer's Mind Reader: think of the dime; the page names it after the swaps; then numbers and a wrong ending.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hummers-mind-reader
export default async ({ page, first, log, shot, text }) => {
  const coins = page.locator(".coin");
  const swap = async (a, b) => { await coins.nth(a).click(); await coins.nth(b).click(); };
  log("start:", await coins.count(), "coins");
  await shot("start");
  // thought of the dime (2): secret swap of penny and nickel; then announced swaps 2-0, 1-2, 2-0 end in the original order
  await swap(2, 0); await swap(1, 2); await swap(2, 0);
  await page.click("#announceBtn");
  log("announced:", (await text("#say")).replace(/\s+/g, " "), "|", await text("#status"));
  await shot("announced");
  if (!first) return;
  log("coins disabled after Announce:", await coins.first().isDisabled());
  await page.click("#resetBtn");
  await page.check("#useNumbers");
  await swap(0, 1);
  await page.click("#announceBtn");
  log("numbers:", await text("#status"));
  await page.click("#resetBtn");
  await page.click("#announceBtn");
  log("still in order: asks:", await text("#status"));
  await page.click("#resetBtn");
  await coins.nth(0).click(); await coins.nth(0).click();
  log("select then unselect:", await coins.nth(0).getAttribute("aria-pressed"));
};
