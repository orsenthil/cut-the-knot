// Indy's clock hands demo: throw once, run many, change angle and red arc.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs indy-clock-hands

export default async ({ page, first, log, shot, text }) => {
  await page.click("#throwBtn");
  log("after one throw:", await text("#stats"));
  await shot("throw");

  await page.click("#runBtn");
  await page.waitForTimeout(500);
  await page.click("#stopBtn");
  log("after a run:", await text("#stats"));
  await shot("run");

  if (first) {
    await page.fill("#alphaInput", "0");
    await page.locator("#alphaInput").press("Enter");
    await page.fill("#redInput", "120");
    await page.locator("#redInput").press("Enter");
    log("after changes:", await text("#stats"));
    await shot("changed");
  }
};
