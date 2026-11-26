// Stick Broken Into Three Pieces: drag P inside and outside the middle
// triangle, keyboard, break 1000 sticks the longer-piece way.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs stick-in-three
export default async ({ page, first, log, shot, text }) => {
  const at = async (fx, fy) => {
    const b = await page.locator("#board").boundingBox();
    return [b.x + (fx / 400) * b.width, b.y + (fy / 535) * b.height];
  };
  await page.locator("#board").scrollIntoViewIfNeeded();
  let [x, y] = await at(200, 220);
  await page.mouse.move(x, y); await page.mouse.down();
  [x, y] = await at(200, 230); await page.mouse.move(x, y); await page.mouse.up();
  log("inside:", await text("#status"));
  await page.check("#namesBox");
  await shot("inside");
  [x, y] = await at(80, 300);
  await page.mouse.click(x, y);
  log("outside:", await text("#status"));
  if (!first) return;
  await page.focus("#board .handle");
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
  log("keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("class")));
  await page.selectOption("#method", "longer");
  for (let i = 0; i < 5; i++) await page.click("#many");
  log("longer piece:", await text("#tally"));
  await shot("longer");
};
