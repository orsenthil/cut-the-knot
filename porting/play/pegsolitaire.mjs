// Peg Solitaire: solve Cross with a known shortest path, then exercise Central.
export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#puzzleSelect", "0"); // Cross
  await idle();

  // Shortest solution found by BFS on the core (see porting/check-pegsolitaire.mjs).
  const crossWin = [
    { from: [3, 2], to: [1, 2] },
    { from: [3, 4], to: [3, 2] },
    { from: [4, 2], to: [2, 2] },
    { from: [1, 2], to: [3, 2] },
    { from: [3, 1], to: [3, 3] },
  ];
  for (const m of crossWin) {
    await page.click(`.cell[data-i="${m.from[0]}"][data-j="${m.from[1]}"]`);
    await page.click(`.cell[data-i="${m.to[0]}"][data-j="${m.to[1]}"]`);
  }
  log("after Cross win:", await text("#status"));
  await shot("win");

  if (!first) return;

  await page.click("#resetBtn");
  await page.selectOption("#puzzleSelect", "6");
  await idle();
  await page.click('.cell[data-i="3"][data-j="1"]');
  await page.click('.cell[data-i="3"][data-j="3"]');
  log("after a jump:", await text("#pegLine"));
  await page.click("#undoBtn");
  log("after Undo:", await text("#pegLine"));

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await shot("central");

  await page.selectOption("#puzzleSelect", "9");
  await page.check("#designChk");
  log("design mode:", await text("#status"));
  await page.click("#resetBtn");
};
