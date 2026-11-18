// All Combinations demo: change N and M in both directions, watch the count
// and the first rows, including the big C(20,10) board.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs all-combinations

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("first rows:", (await page.locator(".combo").allTextContents()).slice(0, 3).join(" | "));
  await shot("start");

  if (first) {
    await page.click("#nLess");
    await page.click("#nMore");
    await page.click("#mLess");
    await page.click("#mMore");
    log("after both directions:", await text("#status"));
    await shot("options");
  }

  for (let i = 0; i < 15; i++) await page.click("#nMore");
  for (let i = 0; i < 7; i++) await page.click("#mMore");
  log("big board:", await text("#status"));
  log("shown rows:", await page.locator(".combo").count(), "| overflow note:", await page.locator(".combo-more").count());
  await shot("large");
};
