// Infinite Latin square demo: change size and modulus, check the grid.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs infinite-latin-square

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("cells:", await page.locator(".cell").count());
  await shot("start");

  if (first) {
    await page.locator("#levelInput").fill("1");
    await page.locator("#levelInput").dispatchEvent("input");
    log("small:", await text("#status"));
    await shot("small");
  }
  await page.locator("#levelInput").fill("5");
  await page.locator("#levelInput").dispatchEvent("input");
  log("large:", await text("#status"));
  log("cells:", await page.locator(".cell").count());
  await shot("large");
  await page.fill("#modInput", "4");
  await page.locator("#modInput").press("Enter");
  log("coloured:", await text("#status"));
  await shot("coloured");
};
