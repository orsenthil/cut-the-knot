// Derivatives of Sine and Cosine: run slow and fast, stop, drag P, turn it
// with the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sine-cosine-derivatives
export default async ({ page, first, log, shot, text }) => {
  await page.click("#runBtn");
  await page.waitForTimeout(800);
  log("running slow:", await text("#readout"));
  await page.check('input[value="fast"]');
  await page.waitForTimeout(800);
  await page.click("#runBtn");
  log("stopped:", await text("#status"), "|", await text("#readout"));
  await shot("running");
  if (!first) return;
  const box = await page.locator("#board").boundingBox();
  const at = (deg) => [box.x + box.width * (200 + 90 * Math.cos(deg * Math.PI / 180)) / 400, box.y + box.height * (200 - 90 * Math.sin(deg * Math.PI / 180)) / 400];
  const [x0, y0] = at(45), [x1, y1] = at(135);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  log("dragged to 135:", await text("#readout"), "|", await text("#status"));
  await shot("dragged");
  await page.focus("#board .handle");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  log("keyboard:", await text("#readout"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("class")));
  await page.keyboard.press("PageUp");
  log("page up:", await text("#readout"));
  await page.check('input[value="slow"]');
  await page.click("#runBtn");
  await page.waitForTimeout(500);
  await page.click("#runBtn");
  log("slow again:", await text("#readout"));
};
