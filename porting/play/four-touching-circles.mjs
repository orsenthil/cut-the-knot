// Four Touching Circles: two configurations of the same ring.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-touching-circles
export default async ({ page, first, log, shot, text }) => {
  // First configuration: the original chain and its inverted images with the
  // inversion centre at its starting place.
  await page.click("#invChk");
  log("inverted diagram:", await text("#status"));
  await idleButtons(page);
  await shot("inverted");

  // Second configuration: put O on E, which turns the two circles tangent at
  // E into two parallel lines, as on the cut-the-knot page.
  await page.click("#invertAtEBtn");
  log("inversion centred at E:", await text("#status"));
  await shot("parallel");

  if (!first) return; // dark run only needs the two screenshots

  // Keyboard: move E twice and make sure the focus survives the redraw.
  const e = page.locator('#board [role="button"][aria-label^="Point E"]');
  await e.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const stillFocused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label").startsWith("Point E"));
  log("E after two arrow keys:", await text("#status"), "| focus kept:", stillFocused);
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};

async function idleButtons(page) {
  await page.waitForTimeout(120);
}
