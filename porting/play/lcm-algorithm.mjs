// LCM algorithm demo: step, run, edit a number and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lcm-algorithm

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("start");

  await page.click("#stepBtn");
  log("after a step:", await text("#status"));
  await shot("step");

  if (first) {
    await page.click("#runBtn");
    log("after Run:", await text("#status"));
    await shot("run");
  }

  await page.fill('input[data-part="original"][data-index="0"]', "7");
  await page.locator('input[data-part="original"][data-index="0"]').press("Enter");
  log("after editing:", await text("#readout"));
  await shot("edited");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
