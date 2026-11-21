// Rouse Ball's fallacy demo: drag E, toggle the hint and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs rouse-ball-fallacy

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  if (first) {
    const handle = await page.locator('.handle[data-name="E"]').boundingBox();
    const box = await page.locator("#board").boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.15, { steps: 6 });
    await page.mouse.up();
    log("after dragging E:", await text("#status"));
    await shot("dragged");
  }

  await page.check("#hintCheck");
  log("with the flaw shown:", await text("#status"));
  await shot("hint");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
