// IFS demo: start, stop, clear and switch systems.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs iterated-function-systems

export default async ({ page, first, log, shot, text }) => {
  await page.click("#startBtn");
  await page.waitForTimeout(400);
  await page.click("#stopBtn");
  log("gasket:", await text("#status"));
  await shot("gasket");

  await page.click("#clearBtn");
  log("after clear:", await text("#status"));
  if (first) {
    await page.selectOption("#systemSel", "Fern");
    await page.click("#startBtn");
    await page.waitForTimeout(400);
    await page.click("#stopBtn");
    log("fern:", await text("#status"));
    await shot("fern");
  }
  await page.selectOption("#systemSel", "Square");
  await page.click("#startBtn");
  await page.waitForTimeout(300);
  await page.click("#stopBtn");
  log("square:", await text("#status"));
  await shot("square");
};
