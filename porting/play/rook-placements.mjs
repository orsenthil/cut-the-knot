// Rooks and Matchings: find every placement on board 1 (a win), a refused
// square, keyboard, a 6 x 6 board.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs rook-placements
export default async ({ page, first, log, shot, text }) => {
  const all = await page.evaluate(() => RookPlacementsCore.placements(RookPlacementsCore.board(4, 1)));
  for (const p of all) {
    await page.click("#clearBtn");
    for (let i = 0; i < p.length; i++) await page.click(`#board [data-i="${i}"][data-j="${p[i]}"]`);
  }
  log("all found:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("all");
  if (!first) return;
  await page.click("#newBtn");
  const blocked = await page.$("#board .sq.blocked");
  if (blocked) await blocked.click({ force: true });
  log("blocked click:", await text("#status"));
  await page.focus('#board [data-i="0"][data-j="0"]'); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard:", await text("#status"));
  await page.selectOption("#sizeIn", "6");
  log("6 x 6:", await text("#status"));
  await shot("six");
};
