// Binomial Distribution is a demo: log the opening state, set both options to
// their maximum, make two keyboard moves with a focus check, press every
// button in player order, then drive both sliders to each extreme (including
// values outside their ranges). The status line says in words what changed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs binomial-distribution
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  log("initial:", await text("#status"));
  await shot("start");

  // Both options at the applet's maximum: p = 1.10 (raw 110) and n = 105.
  await page.locator("#pSlider").fill("110");
  log("p at maximum:", await text("#status"));
  await page.locator("#nSlider").fill("105");
  log("both at maximum:", await text("#status"));
  await shot("max-options");

  // Two keyboard moves on the chart; focus must stay on the board.
  await page.focus("#chart");
  await page.keyboard.press("ArrowLeft");
  log("after ArrowLeft:", await text("#status"), "| focus:", await focus());
  await page.keyboard.press("ArrowRight");
  log("after ArrowRight:", await text("#status"), "| focus:", await focus());
  await shot("keyboard");

  // Every button, in the order a player would press them.
  await page.click("#modeBtn");
  log("after Most likely k:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  await shot("buttons");

  // Both extremes, including values outside the sliders' ranges.
  await page.locator("#pSlider").fill("0");
  log("p at minimum (0):", await text("#status"));
  await page.locator("#nSlider").fill("2");
  log("n at minimum (2):", await text("#status"));
  await shot("min-options");

  await page.locator("#pSlider").fill("999");
  log("p after a high value (clamped to 1.10):", await text("#status"));
  await page.locator("#pSlider").fill("-5");
  log("p after a low value (clamped to 0):", await text("#status"));
  await page.locator("#nSlider").fill("999");
  log("n after a high value (clamped to 105):", await text("#status"));
  await page.locator("#nSlider").fill("0");
  log("n after a low value (clamped to 2):", await text("#status"));
  await shot("out-of-range");

  if (!first) return; // the dark run only needs the screenshots above
};
