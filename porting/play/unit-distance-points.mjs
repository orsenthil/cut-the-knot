// Unit Distance Points: make a triangle by dragging, then show a best arrangement.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs unit-distance-points
export default async ({ page, first, log, shot, text }) => {
  const setN = (v) => page.locator("#n").evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  await setN(3);
  log("start:", await text("#readout"));
  await shot("start");
  // keyboard: bring the three dots into a unit triangle is fiddly, so use the mouse
  const box = await page.locator("#board").boundingBox();
  const s = box.width / 640;
  const px = (x, y) => [box.x + (320 + x * 100) * s, box.y + (210 - y * 100) * s];
  const st = await page.evaluate(() => UnitDistanceCore.start(3));
  const drag = async (i, x, y) => { const [a, b] = px(st[i].x, st[i].y), [c, d] = px(x, y); await page.mouse.move(a, b); await page.mouse.down(); await page.mouse.move(c, d, { steps: 6 }); await page.mouse.up(); };
  await drag(0, -0.5, -0.4);
  await drag(1, 0.5, -0.4);
  await drag(2, 0.0, 0.47);
  log("after dragging:", await text("#readout"), "|", await text("#status"));
  await shot("triangle");
  if (!first) return;
  await setN(9);
  await page.click("#showBtn");
  log("nine points:", await text("#readout"));
  await shot("nine");
  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
};
