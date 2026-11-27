// Gothic Arc: show both configurations of the applet's mode radio button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gothic-arc
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#board .chain-circle.first");
  if (first) log("gothic arc, names on:", await text("#status"));
  await shot("gothic-arc");

  await page.click("#arbelosRadio");
  await page.click("#namesChk");
  await idle(() => document.querySelectorAll("#board .gothic-arc-inner").length === 1);
  if (first) log("arbelos, names off:", await text("#status"));
  await shot("arbelos");

  if (first) {
    await page.focus('#board circle[aria-label^="Point B"]');
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const focus = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
    log("focus after two arrow keys:", focus);
    log("after keyboard nudges:", await text("#status"));
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
  }
};
