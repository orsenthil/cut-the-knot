// Counting Chips On a Circle: group the reds together on 16 chips, then an
// unequal flip, keyboard, 40 chips.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs chips-on-circle
export default async ({ page, first, log, shot, text }) => {
  const chip = (i) => `#board .chip[data-i="${i}"]`;
  // reds at 1,3,...,15 -> move them to 0..7: flip 0,2,4,6 (green to red) and 9,11,13,15 (red to green)
  for (const i of [0, 2, 4, 6, 9, 11, 13, 15]) await page.click(chip(i));
  log("grouped:", await text("#status"));
  await shot("grouped");
  if (!first) return;
  await page.click(chip(8));
  log("unequal:", await text("#status"));
  await page.focus(chip(8)); await page.keyboard.press("Enter"); await page.keyboard.press("ArrowRight");
  log("keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.i));
  await page.fill("#nIn", "40"); await page.dispatchEvent("#nIn", "change");
  log("40 chips:", await text("#status"));
  await shot("forty");
};
