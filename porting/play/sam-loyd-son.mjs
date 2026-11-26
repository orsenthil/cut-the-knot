// Sam Loyd's Son's Dissection: drag a piece, use a button, Animate, then
// Cheat, the largest and smallest sizes, Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sam-loyd-son
export default async ({ page, first, log, shot, text }) => {
  const box = await page.locator("#board").boundingBox();
  const at = (x, y) => [box.x + (x / 640) * box.width, box.y + (y / 360) * box.height];
  // Drag the top triangle (top strip of the square) towards the right.
  const [x0, y0] = at(150, 60);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const [x1, y1] = at(420, 190);
  await page.mouse.move(x1, y1, { steps: 8 });
  await page.mouse.up();
  log("after a drag:", await text("#status"));
  await page.click('#pieceBtns button[data-id="3"]');
  log("after a button:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.textContent));
  await page.click("#animBtn");
  await page.waitForTimeout(3500);
  log("after Animate:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("honest");
  if (!first) return;

  await page.check("#cheatBox");
  await page.click("#animBtn");
  await page.waitForTimeout(3500);
  log("cheat:", await text("#status"));
  await shot("cheat");
  await page.selectOption("#sizeSel", "10");
  await page.click("#animBtn");
  await page.waitForTimeout(3500);
  log("largest:", await text("#status"));
  await shot("largest");
  await page.uncheck("#cheatBox");
  await page.selectOption("#sizeSel", "3");
  await page.focus('#pieceBtns button[data-id="0"]');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
  }
  log("smallest by keyboard:", await text("#status"));
  await page.selectOption("#sizeSel", "6");
  await page.click("#animBtn");
  await page.waitForTimeout(3500);
  log("13 x 13:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("final");
};
