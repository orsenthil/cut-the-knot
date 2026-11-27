// Dave Richeson: two configurations of the theorem, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs dave-richeson
export default async ({ page, first, log, shot, text }) => {
  const total = async () => Number((await text("#status")).match(/Signed sum (-?[\d.]+)/)[1]);

  // Configuration 1: six vertices, moved with the keyboard alone.
  const start = await total();
  await page.locator("#board .geom-handle").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after two arrow keys:", await text("#status"), "| focus:", focus);
  if (first && !focus.startsWith("Vertex 1.")) throw new Error("focus left the dragged vertex");
  await shot("six-corners");

  if (!first) return; // the dark run only needs the two screenshots

  // Triangulate again: the applet picks new ears; the total must not move.
  await page.click("#triangulateBtn");
  const afterCuts = await total();
  log("after Triangulate again:", await text("#status"));
  if (Math.abs(afterCuts - start) > 0.01) throw new Error("the signed sum changed with the triangulation");

  // Change the option in both directions, ending at the largest size.
  await page.fill("#nInput", "3");
  await page.dispatchEvent("#nInput", "change");
  log("at the minimum (3):", await text("#status"));
  await page.fill("#nInput", "30");
  await page.dispatchEvent("#nInput", "change");
  log("at the maximum (30):", await text("#status"));
  await page.click("#triangulateBtn");
  log("after re-triangulating 30 corners:", await text("#status"));
  await shot("thirty-corners");

  await page.click("#resetBtn");
  log("after Reset polygon:", await text("#status"));
};
