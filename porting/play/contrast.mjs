// Contrast: two configurations of the gray strip and the two flat bars.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs contrast
export default async ({ page, first, log, shot, idle, text }) => {
  const probe = () => page.locator('#board [aria-label^="Probe dot"]');
  const setRange = async (id, value) => {
    await page.locator(`#${id}`).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: a background whose two grains are only one step
  // apart, narrow bars with a wide gap. The bars still share one gray.
  await setRange("width", 45);
  await setRange("height", 60);
  await setRange("minColor", 120);
  await setRange("maxColor", 121);
  await setRange("gap", 80);
  log("one-step range, gap 80:", await text("#status"));
  await shot("small-range");

  // Second configuration: the bar fills the whole board instead.
  await setRange("width", 110);
  await setRange("height", 110);
  await setRange("minColor", 255);
  await setRange("maxColor", 0);
  await setRange("gap", 0);
  log("full board, reversed grays:", await text("#status"));
  await shot("full-board");

  if (!first) return; // the dark run only needs the three screenshots

  // Every slider, in both directions, with the applet's own limits.
  const ranges = [
    ["width", 0, 110], ["height", 0, 110], ["minColor", 0, 255],
    ["maxColor", 0, 255], ["gap", 0, 80],
  ];
  for (const [id, lo, hi] of ranges) {
    await setRange(id, lo);
    await setRange(id, hi);
  }
  log("all sliders at their upper limits:", await text("#status"));

  // Keyboard alone: focus must stay on the probe after two arrow keys.
  await probe().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
