// Two formations of the CWStar construction, one with the gap-filling arcs
// and one without. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cw-star
export default async ({ page, log, shot, text }) => {
  const setSlider = (id, value) => page.evaluate(([sel, v]) => {
    const input = document.querySelector(sel);
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id, value]);

  log("first configuration (5 points, extra width 40):", await text("#status"));
  await shot("five-points");

  await setSlider("#stepsInput", 10);      // 23 points, the largest star
  await setSlider("#lengthInput", 310);
  await setSlider("#addOnInput", 160);     // widest gap-filling arcs
  await setSlider("#speedInput", 22);
  log("second configuration (all options at their largest):", await text("#status"));
  await shot("largest-options");

  const status = await text("#status");
  if (!status.includes("23 points") || !status.includes("side length 310")) {
    throw new Error("the sliders did not rebuild the star");
  }
};
