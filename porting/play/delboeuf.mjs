// Delboeuf: two configurations of the equal circles and their neighbours.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs delboeuf
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

  // First configuration: big outside ring, red tint, dark guide lines.
  await setRange("MR", 100);
  await setRange("DR", 2);
  await setRange("WR", 50);
  await setRange("CI", 0);
  await setRange("Ci", 100);
  log("red circles, dark guide lines:", await text("#status"));
  await shot("red-lines");

  // Second configuration: tiny outside ring, blue tint, near-white lines.
  await setRange("MR", 10);
  await setRange("DR", 50);
  await setRange("WR", 50);
  await setRange("CI", 260);
  await setRange("Ci", -100);
  log("blue circles, faint guide lines:", await text("#status"));
  await shot("blue-extreme");

  if (!first) return; // the dark run only needs the three screenshots

  // Every slider, in both directions, with the applet's own limits.
  const ranges = [
    ["MR", 10, 100], ["DR", 1, 50], ["WR", 10, 50],
    ["CI", 0, 260], ["Ci", -100, 100],
  ];
  for (const [id, lo, hi] of ranges) {
    await setRange(id, lo);
    await setRange(id, hi);
  }
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
