// Evelyn: two triangle configurations of the six-circle chain, with the
// highlighted pair changed and the claim checked.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs evelyn
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);

  await idle("#board .geom-handle");
  log("default picture:", await text("#status"));
  await shot("default-six-circles");

  // Pair 3 colours circles 3 and 4 red instead of all six.
  await page.click("#pair2");
  log("pair 3 highlighted:", await text("#status"));
  await shot("pair-three");

  // Move corner B two steps and the starting dot P three steps with the
  // keyboard alone; focus must stay on the dot the player is moving.
  await handle("Corner B").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await handle("Starting dot P").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after keyboard moves:", focused);
  log("second configuration:", await text("#status"));
  await shot("second-configuration");

  if (!first) return; // the dark run only needs the screenshots above

  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));
  await shot("checked");

  await page.click("#pair6");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
