// Straight Tromino on a Chessboard: cover 8 x 8 leaving c3 (a win), a
// refused placement, Remove last, keyboard, colours, 7 x 5.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs tromino-monomino
export default async ({ page, first, log, shot, text }) => {
  const sq = (i, j) => `#board .cell[data-i="${i}"][data-j="${j}"]`;
  const tiling = await page.evaluate(() => TrominoMonominoCore.cover(8, 8, [[5, 2]]));
  for (const [i1, j1, i2, j2] of tiling) { await page.click(sq(i1, j1)); await page.click(sq(i2, j2)); }
  log("covered:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await page.check('input[name="show"][value="tromino"]');
  await page.check("#colourBox");
  await shot("covered");
  if (!first) return;
  await page.click("#resetBtn");
  await page.click(sq(0, 0)); await page.click(sq(0, 2));
  await page.click(sq(0, 1)); await page.click(sq(2, 1));
  log("overlap refused:", await text("#status"));
  await page.click("#removeBtn");
  await page.focus('#board .cell[tabindex="0"]');
  await page.keyboard.press("Enter"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  log("keyboard:", await text("#status"));
  await page.check('input[name="shape"][value="nm"]');
  await page.fill("#nIn", "7"); await page.fill("#mIn", "5"); await page.dispatchEvent("#mIn", "change");
  log("7 x 5:", await text("#status"));
  await shot("seven-by-five");
};
