// Rolle's and the Mean Value Theorems: Find c, drag X across it, make the curve wavy and cycle the points, keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs mean-value-theorem
export default async ({ page, first, log, shot, text }) => {
  log("start:", (await text("#readout")).replace(/\n/g, " | "), "|", await text("#status"));
  await shot("start");
  await page.click("#findBtn");
  log("after Find c:", await text("#status"));
  await shot("parallel");
  const x = page.locator('circle[data-k="x"][tabindex]');
  const b = await x.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + 60, b.y + b.height / 2, { steps: 10 }); await page.mouse.up();
  log("dragged X right:", (await text("#readout")).split("\n")[1], "|", await text("#status"));
  if (!first) return;
  // make the curve wavy with the keyboard and cycle the mean-value points
  for (const k of [2, 4, 6]) { await page.locator(`rect[data-k="y${k}"][tabindex]`).focus(); for (let i = 0; i < 6; i++) await page.keyboard.press(k === 4 ? "ArrowDown" : "ArrowUp"); }
  await page.click("#findBtn"); await page.click("#findBtn");
  log("wavy curve, Find c twice:", await text("#status"));
  await shot("wavy");
  await page.locator('circle[data-k="a"][tabindex]').focus();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Shift+ArrowRight");
  log("keyboard moved A, focus kept:", await page.evaluate(() => document.activeElement.getAttribute("data-k")), "|", (await text("#readout")).split("\n")[0]);
  await page.click("#resetBtn");
  log("after reset:", (await text("#readout")).split("\n")[0]);
};
