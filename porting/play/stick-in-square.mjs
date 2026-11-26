// Stick Broken Into Three Pieces (Cartesian): drag P into a pink triangle,
// then the two-step experiment with 3000 sticks and the green triangles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs stick-in-square
export default async ({ page, first, log, shot, text }) => {
  await page.evaluate(() => window.scrollTo(0, document.getElementById("board").getBoundingClientRect().top + window.scrollY - 170));
  const at = async (fx, fy) => { const b = await page.locator("#board").boundingBox(); return [b.x + (fx / 400) * b.width, b.y + (fy / 500) * b.height]; };
  let [x, y] = await at(20 + 0.35 * 300, 20 + 300 - 0.7 * 300);
  await page.mouse.click(x, y);
  log("pink:", await text("#status"));
  await page.check("#namesBox");
  await shot("pink");
  if (!first) return;
  await page.check('input[name="mode"][value="two"]');
  for (let i = 0; i < 3; i++) await page.click("#many");
  log("two steps:", await text("#tally"));
  [x, y] = await at(20 + 0.4 * 300, 20 + 300 - 0.1 * 300);
  await page.mouse.click(x, y);
  log("green:", await text("#status"));
  await page.focus("#board .handle");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowUp");
  log("keyboard:", await text("#status"));
  await shot("two");
};
