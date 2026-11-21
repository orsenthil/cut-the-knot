// Langman's paradox demo: toggle Cheat, change the Fibonacci size.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs langman-paradox

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("areas:", await text("#readout"));
  await shot("start");

  await page.check("#cheatCheck");
  log("cheat on:", await text("#status"));
  await shot("cheat");

  if (first) {
    await page.locator("#nInput").fill("10");
    await page.locator("#nInput").dispatchEvent("input");
    log("at n=10:", await text("#readout"));
    await shot("n10");
  }

  await page.uncheck("#cheatCheck");
  log("cheat off:", await text("#status"));
  await shot("plain");
};
