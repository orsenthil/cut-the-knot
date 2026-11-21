// Life-like automaton demo: pick presets, toggle a rule, run and reverse.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs life-like-automaton

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("start");

  await page.selectOption("#presetSel", "highlife");
  log("HighLife:", await text("#readout"));
  await shot("highlife");

  if (first) {
    await page.locator('input[aria-label="Birth with 1 neighbours"]').check();
    log("after toggling B1:", await text("#status"));
    await shot("rule");
  }

  await page.click("#randomBtn");
  await page.click("#stepBtn");
  log("after a step:", await text("#readout"));
  await shot("step");
  await page.click("#reverseBtn");
  log("after reverse:", await text("#readout"));
  await shot("reverse");
};
