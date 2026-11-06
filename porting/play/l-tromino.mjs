// L-trominoes: tile 2x3 by clicking; 3x3 cannot be finished; Remove last; Blocks view; 5x6 from the solver.
const clickCell = async (page, r, c) => {
  await page.locator(`#board g[role=row]:nth-of-type(${r + 1}) rect.sq >> nth=${c}`).click();
};
const enterTiling = async (page, rows, cols) => {
  const pieces = await page.evaluate(([r, c]) => LTrominoCore.canTile(r, c), [rows, cols]);
  const touch = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  for (const p of pieces) {
    const corner = p.find((a) => p.filter((b) => b !== a && touch(a, b)).length === 2);
    const ends = p.filter((a) => a !== corner);
    for (const [r, c] of [ends[0], corner, ends[1]]) await clickCell(page, r, c);
  }
};
export default async ({ page, first, log, shot, text }) => {
  await page.selectOption("#rowsInput", "2");
  await page.selectOption("#colsInput", "3");
  await enterTiling(page, 2, 3);
  log("2x3:", await text("#status"));
  await page.selectOption("#rowsInput", "5");
  await page.selectOption("#colsInput", "6");
  await enterTiling(page, 5, 6);
  log("5x6:", await text("#status"));
  await shot("wire");
  if (!first) return;
  await page.check('input[name="view"][value="blocks"]');
  await shot("blocks");
  await page.click("#undoBtn");
  log("after Remove last:", JSON.stringify(await text("#status")));
  await page.selectOption("#rowsInput", "3");
  await page.selectOption("#colsInput", "3");
  await clickCell(page, 0, 0); await clickCell(page, 0, 1); await clickCell(page, 0, 2);
  log("3x3, a straight line of three:", await page.$$eval("#board .sq.picked", (p) => p.length), "square(s) picked (restarted)");
};
