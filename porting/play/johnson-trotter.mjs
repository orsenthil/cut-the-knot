// Johnson–Trotter demo: step, run, stop, change size and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs johnson-trotter

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("cells:", await page.locator(".item").count());
  await shot("start");

  await page.click("#stepBtn");
  log("after one step:", await text("#status"));
  await shot("step");

  if (first) {
    await page.click("#runBtn");
    await page.waitForTimeout(500);
    await page.click("#stopBtn");
    log("after a run:", await text("#status"));
    await shot("run");
  }

  await page.fill("#nInput", "3");
  await page.locator("#nInput").dispatchEvent("input");
  log("with n=3:", await text("#status"));
  await shot("n3");

  for (let i = 0; i < 5; i++) await page.click("#stepBtn");
  log("after six steps:", await text("#status"));
  await shot("done");
};
