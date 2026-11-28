// Disappearing Lines: start with 10 lines, then use "Show the trick" to lose one;
// finish with the widest range (25 lines), slid to the target corner.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lines
export default async ({ page, first, log, shot, idle, text }) => {
  await idle();
  log("initial:", await text("#status"), "|", await text("#count"));
  await shot("start-10");

  // First configuration: the one-notch slide at the default size opens the eyes.
  await page.click("#slideBtn");
  await idle();
  log("after one-notch slide:", await text("#status"), "|", await text("#count"));
  await shot("trick-10");

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: the applet's maximum, 25 lines, slid to the same corner.
  await page.selectOption("#nInput", "25");
  await idle();
  log("25 lines, reset:", await text("#status"), "|", await text("#count"));
  await shot("start-25");
  await page.click("#slideBtn");
  await idle();
  log("25 lines, trick:", await text("#status"), "|", await text("#count"));
  await shot("trick-25");

  // Keyboard-only: move the upper piece away and back with the arrow keys.
  const grip = page.locator("#board .grip");
  await grip.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await idle();
  log("after arrow keys:", await text("#status"), "| focus:", await grip.evaluate((el) => el === document.activeElement));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
