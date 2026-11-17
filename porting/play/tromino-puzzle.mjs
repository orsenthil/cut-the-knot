// Tromino Puzzle: set a 4x4 gap, tile it with Golomb's unique solution, look
// at the Blocks style, then leave a pocket on purpose, undo it, and reset.
export default async ({ page, first, log, shot, text }) => {
  const n = 4;
  const clickCell = async (row, col) => {
    const box = await page.locator("#board").boundingBox();
    await page.mouse.click(
      box.x + ((col + 0.5) * box.width) / n,
      box.y + ((row + 0.5) * box.height) / n,
    );
  };
  const play = async (cells) => { for (const [r, c] of cells) await clickCell(r, c); };

  await page.selectOption("#expInput", "2");
  await page.click("#blankBtn"); // clears the board and switches to Set blank
  await clickCell(0, 0);
  await page.click("#playBtn");
  log("blank set:", await text("#status"));
  log("line:", await text("#line"));

  // The unique 4x4 tiling for the gap at the upper-left corner.
  await play([[0, 1], [1, 1], [1, 0]]);
  await play([[1, 2], [2, 2], [2, 1]]);
  await play([[0, 2], [0, 3], [1, 3]]);
  await play([[2, 3], [3, 3], [3, 2]]);
  await play([[3, 1], [3, 0], [2, 0]]);
  log("after the tiling:", await text("#status"));
  log("line:", await text("#line"));
  await shot("win");

  await page.click("#blocksBtn");
  await shot("blocks");
  await page.click("#wireBtn");

  // A pocket: four pieces leave three squares that cannot form an L.
  await page.click("#blankBtn");
  await page.click("#playBtn");
  await play([[0, 1], [1, 1], [1, 0]]);
  await play([[0, 2], [0, 3], [1, 3]]);
  await play([[1, 2], [2, 2], [2, 3]]);
  await play([[2, 0], [2, 1], [3, 1]]);
  log("after four careless pieces:", await text("#status"));
  log("line:", await text("#line"));
  await shot("pocket");

  await page.click("#undoBtn");
  log("after Remove last:", await text("#status"));
  if (!first) return; // the dark run only needs the screenshots above

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // Keyboard: the cursor starts on the gap; step off it and start a piece.
  await page.focus("#board");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("after a keyboard click:", await text("#status"));
  await shot("keyboard");
};
