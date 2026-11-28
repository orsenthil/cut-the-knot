// Judd Illusion: two configurations of the bar, its arrow heads and its middle mark.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs judd-illusion
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = async (id, value) => {
    await page.locator(`#${id}`).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: long bar, thick strokes, tall arrow heads leaning left.
  for (const [id, value] of [["L", 45], ["W", 20], ["H", 110], ["A", -90], ["B", 40]]) {
    await setRange(id, value);
  }
  await page.locator("#bob").setChecked(true);
  log("left-leaning arrow heads:", await text("#status"));
  await shot("left-arrows");

  // Second configuration: short thin bar, arrow heads leaning right, and the
  // middle rectangle replaced by an arrow head.
  for (const [id, value] of [["L", 10], ["W", 0], ["H", 50], ["A", 90], ["B", 10]]) {
    await setRange(id, value);
  }
  await page.locator("#bob").setChecked(false);
  log("arrow head in the middle:", await text("#status"));
  await shot("center-arrow");

  if (!first) return; // the dark run only needs the three screenshots

  // Every slider, in both directions, with the applet's own limits.
  const ranges = [
    ["L", 10, 45], ["W", 0, 20], ["H", 10, 110], ["A", -90, 90], ["B", 1, 40],
  ];
  for (const [id, lo, hi] of ranges) {
    await setRange(id, lo);
    await setRange(id, hi);
  }
  await page.locator("#bob").setChecked(true);
  log("all sliders at their upper limits:", await text("#status"));

  // Keyboard alone: focus must stay on the probe after two arrow keys.
  const probe = () => page.locator('#board [aria-label^="Probe dot"]');
  await probe().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
