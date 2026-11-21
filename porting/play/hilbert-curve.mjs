// Hilbert/Moore curve demo: change the order in both directions and switch kinds.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hilbert-curve

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("path points:", await page.locator(".curve").getAttribute("points").then((s) => s.trim().split(/\s+/).length));
  await shot("start");

  if (first) {
    await page.locator("#orderInput").fill("1");
    await page.locator("#orderInput").dispatchEvent("input");
    log("order 1:", await text("#status"));
    await shot("order1");
  }
  await page.locator("#orderInput").fill("6");
  await page.locator("#orderInput").dispatchEvent("input");
  log("order 6:", await text("#status"));
  await shot("order6");
  await page.check('input[value="moore"]');
  log("Moore:", await text("#status"));
  await shot("moore");
};
