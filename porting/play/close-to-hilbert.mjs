// Close To Hilbert: two configurations of the illustration, in both themes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs close-to-hilbert
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the first semicircle approximation, as the applet opens.
  log("initial:", await text("#status"));
  await shot("semicircles");

  // Configuration 2: switch to tents and grow the word over several clicks.
  await page.click("#nextBtn");
  await page.click("#nextBtn");
  await page.click("#tentBtn");
  await page.click("#nextBtn");
  await page.click("#nextBtn");
  await page.click("#nextBtn");
  log("tents:", await text("#status"));
  log("tents pressed:", await page.getAttribute("#tentBtn", "aria-pressed"));
  await shot("tents");

  if (!first) return; // the dark run only needs the two screenshots above

  // The picture itself is keyboard-operable, and the slider keeps focus.
  await page.focus("#board");
  await page.keyboard.press("Enter");
  log("keyboard deeper:", await text("#status"));
  await page.keyboard.press("-");
  log("keyboard back:", await text("#status"));
  await page.focus("#board circle.geom-handle");
  await page.keyboard.press("ArrowLeft");
  log("slider back:", await text("#status"));
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
