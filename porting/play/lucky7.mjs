// Lucky 7: two configurations, one at the default size and one at the largest.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lucky7
export default async ({ page, first, log, shot, text }) => {
  log("home:", await text("#status"));

  // Configuration 1: seven counters, scrambled, with the cycles hint on.
  await page.click("#shuffleBtn");
  await page.check("#cyclesBox");
  await page.click('#moveButtons button[data-move="leftM"]');
  await page.click('#moveButtons button[data-move="circP"]');
  await page.focus(".geom-handle");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  log("after moves:", await text("#status"));
  log("focus kept:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  await shot("seven");

  // Configuration 2: the largest board (13 counters), scrambled again.
  await page.click("#moreBtn");
  await page.click("#moreBtn");
  await page.click("#moreBtn");
  log("size:", await text("#count"));
  await page.click("#shuffleBtn");
  await shot("thirteen");

  // Press every remaining control in the order a player would.
  await page.click("#cheatBtn");
  log("after cheat:", await text("#status"));
  await page.uncheck("#cyclesBox");
  log("without cycles:", await text("#status"));
  await page.click("#lessBtn");
  log("smaller:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  if (!first) return;
};
