// Two Perpendiculars: drag A, hint, fallacy 2, honest drawing, keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs two-perpendiculars
export default async ({ page, first, log, shot, text }) => {
  await page.evaluate(() => window.scrollTo(0, document.getElementById("board").getBoundingClientRect().top + window.scrollY - 170));
  const at = async (x, y) => { const b = await page.locator("#board").boundingBox(); return [b.x + ((x + 30) / 460) * b.width, b.y + ((y + 30) / 360) * b.height]; };
  const a = await page.locator('#board .handle[data-p="A"]').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  const [x, y] = await at(110, 150); await page.mouse.move(x, y, { steps: 4 }); await page.mouse.up();
  await page.check("#hintBox");
  log("fallacy 1 + hint:", await text("#status"));
  await shot("fallacy-one");
  if (!first) return;
  await page.check('input[name="fallacy"][value="2"]');
  log("fallacy 2:", await text("#status"));
  await page.check("#honestBox");
  log("honest:", await text("#status"));
  await page.focus('#board .handle[data-p="B"]');
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  log("keyboard:", await page.evaluate(() => document.activeElement.dataset.p));
  await shot("honest");
};
