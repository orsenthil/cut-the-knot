// All Permutations demo: switch N and all three generators, check the first
// rows and the factorial count, including the big n=8 board.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs all-permutations

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("first rows:", (await page.locator(".perm").allTextContents()).slice(0, 3).join(" | "));
  await shot("start");

  if (first) {
    await page.click('input[value="lexicographic"]');
    log("lexicographic:", (await page.locator(".perm").allTextContents()).slice(0, 2).join(" | "));
    await shot("lexicographic");
    await page.click('input[value="heap"]');
    log("heap:", (await page.locator(".perm").allTextContents()).slice(0, 2).join(" | "));
    await shot("heap");
    await page.click('input[value="recursive"]');
    await page.click("#nLess");
    await page.click("#nMore");
    log("after both directions:", await text("#status"));
    await shot("options");
  }

  for (let i = 0; i < 5; i++) await page.click("#nMore");
  log("big board:", await text("#status"));
  log("shown rows:", await page.locator(".perm").count(), "| overflow note:", await page.locator(".perm-more").count());
  await shot("large");
};
