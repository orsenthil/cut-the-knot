// Counting Triangles II: the snake for n = 5 (a win), a refused click,
// Remove last, keyboard, hint, n = 16.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs triangle-chain
export default async ({ page, first, log, shot, text }) => {
  const tri = (k, p) => `#board .cell[data-k="${k}"][data-p="${p}"]`;
  const n = 5, path = [[0, 0]];
  for (let k = 1; k < n; k++) {
    if (k % 2) for (let p = 2 * k - 1; p >= 0; p--) path.push([k, p]);
    else for (let p = 1; p <= 2 * k; p++) path.push([k, p]);
  }
  for (const [k, p] of path) await page.click(tri(k, p));
  log("snake:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await page.check("#hintBox");
  await shot("snake");
  if (!first) return;
  await page.click("#resetBtn");
  await page.click(tri(2, 2));
  await page.click(tri(4, 0));
  log("not adjacent:", await text("#status"));
  await page.click("#removeBtn");
  await page.focus('#board .cell[tabindex="0"]');
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard step:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.k + "," + document.activeElement.dataset.p));
  await page.fill("#nIn", "16"); await page.dispatchEvent("#nIn", "change");
  log("n = 16:", await text("#status"));
  await shot("sixteen");
};
