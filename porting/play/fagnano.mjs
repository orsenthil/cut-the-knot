// Two configurations of Fagnano: the opening figure and the altitude feet.
// There is nothing to win or lose; the second picture is the shortest case.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fagnano
export default async ({ page, first, log, shot, text }) => {
  log("opening:", await text("#status"));
  await shot("opening");

  await page.click("#altBox");
  await page.click("#namesBox");
  await page.click("#orthicBtn");
  log("altitude feet:", await text("#status"));
  await shot("orthic");

  if (!first) return;

  // The reset button restores the applet's starting fractions, and the
  // keyboard moves a vertex while focus stays on the handle.
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  const vertex = page.locator("#board .vertex-handle").first();
  await vertex.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focused);
  log("after keyboard moves:", await text("#status"));
  await shot("keyboard");
};
