// Addition and Subtraction of Functions: drag f, switch to the difference, shade it.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs adding-functions
export default async ({ page, first, log, shot, text }) => {
  log("start:", (await text("#readout")).replace(/\n/g, " | "));
  await shot("sum");
  await page.check("#ptsBox");
  const knot = page.locator('[data-w="f"][data-i="5"]');
  await knot.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
  log("after lowering f at x = 0:", (await text("#readout")).replace(/\n/g, " | "));
  await page.check("#opSub");
  await page.check("#shadeBox");
  await shot("difference");
  if (!first) return;
  await page.fill("#probe", "-3");
  await page.dispatchEvent("#probe", "input");
  log("probe at -3:", (await text("#readout")).replace(/\n/g, " | "));
};
