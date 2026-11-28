// Intouch Medians: two configurations of the same illustration, no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs intouch-medians
export default async ({ page, first, log, shot, text }) => {
  const handles = page.locator('#board circle[role="button"]');

  // Configuration 1: the applet's own starting triangle with point names on.
  await page.click("#namesCheck");
  log("configuration 1:", await text("#status"));
  await shot("configuration-one");

  // Configuration 2: move B and C with the keyboard alone, then turn on the
  // hint. Geom keeps focus on the handle that was just moved.
  await handles.nth(1).focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowDown");
  const focusAfterB = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await handles.nth(2).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const focusAfterC = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.click("#hintCheck");
  log("focus after moving B:", focusAfterB);
  log("focus after moving C:", focusAfterC);
  log("configuration 2:", await text("#status"));
  await shot("configuration-two");

  // The reset button restores the applet's starting triangle and options.
  await page.click("#resetBtn");
  if (first) {
    log("after reset:", await text("#status"));
    log("names after reset:", await page.isChecked("#namesCheck"));
    log("hint after reset:", await page.isChecked("#hintCheck"));
  }
};
