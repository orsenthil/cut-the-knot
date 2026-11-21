// Hooper's paradox demo: change the parameters in both directions, show the flaw.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hooper-paradox

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  if (first) {
    await page.fill("#wInput", "13");
    await page.locator("#wInput").press("Enter");
    await page.fill("#hInput", "5");
    await page.locator("#hInput").press("Enter");
    log("after keyboard edits:", await text("#status"));
    await shot("keyboard");
  }
  await page.fill("#wInput", "4");
  await page.locator("#wInput").press("Enter");
  log("small width:", await text("#status"));
  await shot("small");

  await page.check("#hintCheck");
  log("with the flaw:", await text("#status"));
  await shot("hint");
};
