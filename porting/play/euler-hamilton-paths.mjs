// Euler & Hamilton paths demo: find a path in Euler mode, switch to Hamilton,
// change graph and use Back/Clear.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-hamilton-paths

export default async ({ page, first, log, shot, text }) => {
  // Triangle: 0 -> 1 -> 2 -> 0 is an Euler cycle but not a Hamilton path.
  await page.selectOption("#graphSel", "0");
  for (const v of [0, 1, 2, 0]) await page.locator(".node").nth(v).click();
  log("Euler on the triangle:", await text("#status"));
  await shot("euler");

  if (first) {
    await page.click("#backBtn");
    log("after Back:", await text("#status"));
    await shot("back");
    await page.click("#clearBtn");
    log("after Clear:", await text("#status"));
  }

  await page.check('input[value="hamilton"]');
  for (const v of [0, 1, 2]) await page.locator(".node").nth(v).click();
  log("Hamilton on the triangle:", await text("#status"));
  await shot("hamilton");

  await page.selectOption("#graphSel", "3");
  log("star in Hamilton mode:", await text("#status"));
  await shot("star");
};
