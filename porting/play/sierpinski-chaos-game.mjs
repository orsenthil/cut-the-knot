// Sierpinski chaos game: run slowly with iterations shown, then fast,
// stop, continue, move a corner by keyboard and by dragging.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sierpinski-chaos-game
export default async ({ page, first, log, shot, text }) => {
  await page.check("#iterBox");
  await page.fill("#delayInput", "100");
  await page.dispatchEvent("#delayInput", "change");
  await page.click("#startBtn");
  await page.waitForTimeout(1200);
  log("slow:", await text("#count"), "|", await text("#status"));
  await page.fill("#delayInput", "0");
  await page.dispatchEvent("#delayInput", "change");
  await page.waitForTimeout(2500);
  await page.click("#stopBtn");
  log("after fast run:", await text("#count"), "|", await text("#status"));
  await shot("gasket");
  if (!first) return;
  await page.fill("#pixelInput", "11");
  await page.dispatchEvent("#pixelInput", "change");
  await page.click("#contBtn");
  await page.waitForTimeout(400);
  await page.click("#stopBtn");
  log("continue with big pixels:", await text("#count"));
  await shot("big-pixels");
  await page.focus('#cornerBtns [data-corner="C"]');
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  log("keyboard corner:", await text("#status"), "|", await text("#count"), "| focus:", await page.evaluate(() => document.activeElement.dataset.corner));
  const box = await page.locator("#board").boundingBox();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * (337 / 450));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, { steps: 5 });
  await page.mouse.up();
  log("dragged B:", await text("#status"));
  await page.click("#startBtn");
  await page.waitForTimeout(2000);
  await page.click("#stopBtn");
  log("new triangle:", await text("#count"));
  await shot("final");
};
