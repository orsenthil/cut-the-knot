// IMO 1986 problem 3 demo: step by hand, solve, and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs imo-1986-3

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#potential"));
  await shot("start");

  if (first) {
    await page.click("#stepBtn");
    log("after one step:", await text("#status"));
    log("readout:", await text("#potential"));
    await shot("step");
  }
  await page.click("#solveBtn");
  log("after solve:", await text("#status"));
  log("readout:", await text("#potential"));
  await shot("solved");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
