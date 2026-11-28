// Hinged Ptolemy: two configurations of the illustration, no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-ptolemy
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the full turn that the proof on the page uses.
  await page.focus("#rotation");
  await page.keyboard.press("End"); // 105, the slider's maximum
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft"); // 100
  await page.click("#names");
  log("full turn:", await text("#status"));
  await shot("full-turn");

  if (!first) return; // the dark run has the same picture

  // Configuration 2: reset, then let the hinge swing 5% past the full turn
  // and move P with the keyboard alone.
  await page.click("#newBtn");
  await page.focus("#rotation");
  await page.keyboard.press("End"); // 105%
  await page.click("#names");
  const handles = page.locator("#board .geom-handle");
  await handles.nth(3).focus(); // P
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after keyboard moves on P:", focus);
  log("past full turn:", await text("#status"));
  await shot("overshoot");
};
