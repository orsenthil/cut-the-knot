// Two Circles, Two Points: drag the right dot until the circles cross twice.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs two-circles-two-points
export default async ({ page, first, log, shot, text }) => {
  log("start:", (await text("#readout")).split("\n")[0]);
  await shot("far apart");
  const box = await page.locator("#board").boundingBox();
  const s = box.width / 640;
  const px = (x, y) => [box.x + (320 + x * 100) * s, box.y + (210 - y * 100) * s];
  const [a, b] = px(1.5, 0.3), [c, d] = px(-0.6, 0.3);
  await page.mouse.move(a, b); await page.mouse.down(); await page.mouse.move(c, d, { steps: 8 }); await page.mouse.up();
  log("after dragging:", (await text("#readout")).split("\n")[0], "|", await text("#status"));
  await shot("two crossings");
  if (!first) return;
  await page.locator("#n").evaluate((el) => { el.value = 100; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("100 points:", (await text("#readout")).split("\n")[1]);
  await page.click("#resetBtn");
  log("after reset:", (await text("#readout")).split("\n")[0]);
};
