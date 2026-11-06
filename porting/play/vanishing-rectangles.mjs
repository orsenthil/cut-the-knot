// Disappearing Rectangles: drag the top half to the vanishing position; nudge buttons; units; 20 rectangles.
export default async ({ page, first, log, shot, text }) => {
  let found = -1;
  const n = Number(await page.$eval("#nInput", (s) => s.value));
  for (let k = 0; k < n; k++) {
    if (/only/.test(await text("#status"))) { found = k; break; }
    await page.click("#topRight");
  }
  log(`nudging the top half: vanished after ${found} step(s):`, await text("#status"));
  await page.check("#unitsInput");
  await shot("vanished");
  if (!first) return;
  // Drag the bottom half by one slot with the mouse; the count changes back.
  const box = await page.$eval("#paper", (s) => { const r = s.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const slot = box.w / n; // 2W of the viewBox in screen pixels
  await page.mouse.move(box.x + box.w / 2, box.y + box.h * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w / 2 + slot * 0.9, box.y + box.h * 0.75, { steps: 6 });
  await page.mouse.up();
  log("after dragging the bottom half one place:", JSON.stringify(await text("#status")), "|", await text("#countLine"));
  await page.check("#lightInput");
  await page.selectOption("#nInput", "20");
  log("20 rectangles:", await page.$$eval("#paper .piece", (p) => p.length), "pieces drawn");
};
