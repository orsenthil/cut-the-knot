// Funny Square: an illustration, so the two "positions" are two configurations.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs funny-square
export default async ({ page, first, log, shot, text }) => {
  // 1. The diagram the applet opens with, with its construction lines shown.
  await page.click("#constructionChk");
  log("construction:", await text("#status"));
  await shot("construction");

  // 2. A keyboard-only change: make AP longer than PR, and show the hint
  //    triangle. Focus must stay on the moved dot.
  await page.click("#hintChk");
  const pDot = page.locator('#board circle[tabindex="0"]').nth(1);
  await pDot.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("after keyboard moves, focus:", focused);
  log("longer AP:", await text("#status"));
  await shot("changed");

  // Still with the keyboard: push P past R, the case the page says needs its
  // triangle proof adjusted. The square and the status stay correct.
  for (let i = 0; i < 12; i++) await page.keyboard.press("Shift+ArrowRight");
  log("outside AR:", await text("#status"));

  // The page's only button, pressed last: a fresh diagram with the same boxes.
  await page.click("#newBtn");
  log("after New diagram:", await text("#status"));
  if (!first) return; // the dark run only needs the two screenshots above
};
