// Lone divider demo: toggle preferences, solve, randomize, change players.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lone-divider

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  await page.click("#solveBtn");
  log("after Solve:", await text("#status"));
  await shot("solved");

  if (first) {
    await page.locator(".grid-row").nth(1).locator(".pref-cell").first().click();
    log("after toggling a preference:", await text("#status"));
    await shot("toggled");
  }

  await page.click("#randomBtn");
  await page.click("#solveBtn");
  log("random table:", await text("#status"));
  await shot("random");

  await page.fill("#nInput", "3");
  await page.locator("#nInput").dispatchEvent("input");
  log("with three players:", await text("#readout"));
  await shot("three");
};
