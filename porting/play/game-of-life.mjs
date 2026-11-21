// Game of Life demo: place a glider, step, run, reverse, randomize.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs game-of-life

export default async ({ page, first, log, shot, text }) => {
  await page.selectOption("#patternSel", "glider");
  log("glider:", await text("#readout"));
  await shot("glider");

  if (first) {
    for (let i = 0; i < 4; i++) await page.click("#stepBtn");
    log("after four steps:", await text("#readout"));
    await shot("moved");
    await page.click("#reverseBtn");
    log("after reverse:", await text("#readout"));
    await shot("reverse");
  }

  await page.click("#randomBtn");
  log("randomized:", await text("#readout"));
  await shot("random");

  await page.click("#startBtn");
  await page.waitForTimeout(500);
  await page.click("#stopBtn");
  log("after running:", await text("#readout"));
  await shot("run");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
