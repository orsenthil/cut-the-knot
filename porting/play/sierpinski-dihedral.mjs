// Sierpinski's Gasket and Dihedral Symmetry: steps, numbers, modulus 3,
// Replace, 3 prongs, largest N, reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sierpinski-dihedral
export default async ({ page, first, log, shot, text }) => {
  const step = (k) => page.click(`#stepBtns [data-steps="${k}"]`);
  await page.fill("#nInput", "16"); await page.dispatchEvent("#nInput", "change");
  await page.check("#numBox");
  await step(1); await step(1); await step(4);
  log("after 6 steps:", await text("#status"));
  await shot("numbers");
  if (!first) return;
  await page.fill("#mInput", "3"); await page.dispatchEvent("#mInput", "change");
  await page.fill("#nInput", "27"); await page.dispatchEvent("#nInput", "change");
  await step(1000);
  log("mod 3, to corner:", await text("#status"));
  await shot("mod3");
  await page.check('input[name="algo"][value="replace"]');
  await step(8);
  log("replace, 8 steps:", await text("#status"));
  await page.check('input[name="prongs"][value="3"]');
  await page.check('input[name="algo"][value="add"]');
  await step(16);
  log("3 prongs add:", await text("#status"));
  await page.fill("#nInput", "128"); await page.dispatchEvent("#nInput", "change");
  log("N=128, numbers disabled:", await page.isDisabled("#numBox"));
  await page.fill("#mInput", "32"); await page.dispatchEvent("#mInput", "change");
  await step(1000);
  log("largest:", await text("#status"));
  await shot("largest");
  await page.focus('#stepBtns [data-steps="1"]');
  await page.keyboard.press("Enter");
  log("keyboard step:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.steps));
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
