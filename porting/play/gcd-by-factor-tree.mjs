// GCD and LCM via Factor Tree demo: inspect a problem, click tree nodes,
// press Repeat and New problem.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gcd-by-factor-tree

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text(".result"));
  await shot("start");

  if (first) {
    await page.locator(".fnode").first().click();
    log("after clicking a factor:", await text("#status"));
    await page.keyboard.press("Tab");
    await shot("click");
    await page.click("#repeatBtn");
    log("after repeat:", await text(".result"));
  }

  await page.click("#newBtn");
  log("after new problem:", await text(".result"));
  await shot("new");
};
