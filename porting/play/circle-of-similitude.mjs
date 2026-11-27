// Circle Of Similitude: two configurations, one with T moved and the hint
// showing the equal angles, one with the two circles at different heights.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-of-similitude
export default async ({ page, first, log, shot, text }) => {
  const handles = "#board circle[tabindex='0']";

  // Configuration 1: the applet's starting picture, T nudged along CS.
  await page.click("#hint");
  await page.focus(`${handles} >> nth=4`); // T
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  log("with T moved and the angle hint:", await text("#status"));
  await shot("configuration-a");

  if (!first) return; // the dark run only needs the screenshot above

  // Configuration 2: reset, then lower the first circle and its radius dot
  // together, so the radii stay different and the centres are not level.
  await page.click("#resetBtn");
  for (const n of [0, 1]) {
    await page.focus(`${handles} >> nth=${n}`); // C1 and R1
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
  }
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after keyboard moves:", focused);
  log("with the circles at different heights:", await text("#status"));
  await shot("configuration-b");
};
