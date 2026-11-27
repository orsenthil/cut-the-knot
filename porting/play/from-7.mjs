// From 7: two configurations of the area demonstration, in both themes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs from-7
export default async ({ page, first, log, shot, text }) => {
  log("N = 1:", await text("#status"));
  await shot("n1");

  // Keyboard movement of a corner: focus must survive each redraw.
  const a = page.locator('#board circle[aria-label^="Corner A."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("after two arrow keys:", await text("#status"));
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after redraw:", focused);
  if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left the corner after a redraw");

  // The second configuration: three side-lengths, grid and colour shown.
  await page.click("#moreBtn");
  await page.click("#moreBtn");
  await page.click("#gridBox");
  await page.click("#colorBox");
  log("N = 3, grid and colour:", await text("#status"));
  await shot("n3-grid-colour");

  if (first) {
    // Press the remaining controls in the order a player would.
    await page.click("#lessBtn");
    await page.fill("#num", "5");
    await page.locator("#num").press("Enter");
    log("typed N = 5:", await text("#status"));
    await page.fill("#num", "0");
    await page.locator("#num").press("Enter");
    log("typed 0 is refused:", await text("#status"));
    await page.click("#resetBtn");
    log("after Reset:", await text("#status"));
  }
};
