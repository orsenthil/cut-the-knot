// Two configurations of Escher's theorem; this is an illustration, so there is
// no win or loss. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs eschers-theorem
export default async ({ page, first, log, shot, text }) => {
  const handles = page.locator('#board [role="button"]');

  // First configuration: names, angles, concurrency and the Napoleon hint.
  for (const id of ["namesBox", "anglesBox", "concurrencyBox", "hintBox"]) {
    await page.check("#" + id);
  }
  await handles.nth(1).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  log("configuration one:", await text("#status"));
  log("focus after two arrow keys:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));
  await shot("one");

  // Second configuration: all five boxes on, including the hexagon copies.
  await page.check("#tessBox");
  await handles.nth(2).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowLeft");
  log("configuration two:", await text("#status"));
  await shot("two");

  if (!first) return; // the dark run only needs the two screenshots

  // Press every control in both directions, then reset as a player would.
  for (const id of ["namesBox", "anglesBox", "concurrencyBox", "tessBox", "hintBox"]) {
    await page.uncheck("#" + id);
    await page.check("#" + id);
  }
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
