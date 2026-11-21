// Archimedes circumference demo: slide n through small and large values.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs archimedes-circumference

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text(".readout"));
  await shot("start");

  if (first) {
    await page.locator("#nInput").fill("3");
    await page.locator("#nInput").dispatchEvent("input");
    log("triangle:", await text(".readout"));
    await shot("triangle");
  }
  await page.locator("#nInput").fill("96");
  await page.locator("#nInput").dispatchEvent("input");
  log("96 sides:", await text(".readout"));
  await shot("96");
};
