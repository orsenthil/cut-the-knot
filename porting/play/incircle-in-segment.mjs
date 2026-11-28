// Incircle In Segment: an illustration, so there is no win or loss. Show two
// configurations, one with the proof lines, and exercise the keyboard and the
// reset button. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs incircle-in-segment
export default async ({ page, first, log, shot, text }) => {
  log("first configuration:", await text("#status"));
  await shot("first");

  const handle = page.locator("#board .geom-handle");
  await handle.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowUp");
  log("focus after the arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("class")));

  await page.locator("#hint").check();
  log("second configuration:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots
  await page.locator("#resetBtn").click();
  log("after reset:", await text("#status"));
};
