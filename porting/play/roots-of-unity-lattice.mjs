// Roots of Unity Lattice: m = 12 at 256 points (ahead of the grid), then 625 (behind), and m = 5.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs roots-of-unity-lattice
export default async ({ page, first, log, shot, text }) => {
  const lines = async () => (await text("#readout")).split("\n").slice(1).join(" | ");
  const setR = (v) => page.locator("#r").evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  log("start:", await lines());
  await setR(3);
  log("r = 3:", await lines(), "|", await text("#status"));
  await shot("r3");
  await setR(4);
  log("r = 4:", await lines(), "|", await text("#status"));
  if (!first) return;
  await page.selectOption("#m", "5");
  log("m = 5:", await lines());
  await shot("m5");
  await page.click("#resetBtn");
  log("after reset:", await lines());
};
