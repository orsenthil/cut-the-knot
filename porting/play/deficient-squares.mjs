// Deficient Squares: set a 5x5 corner gap, tile it, look at the Blocks style,
// then show a 5x5 gap and a 6x6 side that cannot be tiled, undo, reset and
// make a keyboard click.
export default async ({ page, first, log, shot, text }) => {
  const clickCell = async (n, row, col) => {
    const box = await page.locator("#board").boundingBox();
    await page.mouse.click(
      box.x + ((col + 0.5) * box.width) / n,
      box.y + ((row + 0.5) * box.height) / n,
    );
  };
  const play = async (n, cells) => { for (const [r, c] of cells) await clickCell(n, r, c); };

  await page.selectOption("#nInput", "5");
  await page.click("#blankBtn"); // clears the board and switches to Set blank
  await clickCell(5, 0, 0);
  await page.click("#playBtn");
  log("blank set:", await text("#status"));
  log("line:", await text("#line"));

  // One tiling of the 5x5 board with the upper-left corner missing.
  await play(5, [[0, 1], [0, 2], [1, 2]]);
  await play(5, [[0, 3], [0, 4], [1, 4]]);
  await play(5, [[1, 1], [1, 0], [2, 0]]);
  await play(5, [[1, 3], [2, 3], [2, 4]]);
  await play(5, [[2, 2], [2, 1], [3, 1]]);
  await play(5, [[3, 0], [4, 0], [4, 1]]);
  await play(5, [[3, 2], [4, 2], [4, 3]]);
  await play(5, [[3, 3], [3, 4], [4, 4]]);
  log("after the tiling:", await text("#status"));
  log("line:", await text("#line"));
  await shot("win");

  await page.click("#blocksBtn");
  await shot("blocks");
  await page.click("#wireBtn");

  // A 5x5 board with a gap that cannot be tiled (an odd row and odd column).
  await page.click("#blankBtn");
  await clickCell(5, 0, 1);
  log("5x5 bad gap:", await text("#status"));
  await page.click("#playBtn");
  await shot("bad-gap");

  // A side that is a multiple of 3 cannot be tiled at all.
  await page.selectOption("#nInput", "6");
  log("6x6:", await text("#status"));
  log("line:", await text("#line"));
  await shot("impossible");

  if (!first) return; // the dark run only needs the screenshots above

  await page.selectOption("#nInput", "4");
  await page.click("#blankBtn");
  await clickCell(4, 0, 0);
  await page.click("#playBtn");
  log("undo is disabled on an empty board:", await page.locator("#undoBtn").isDisabled());

  // Keyboard: the cursor starts on the gap; step off it and start a piece.
  await page.focus("#board");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log("after a keyboard click:", await text("#status"));
  await shot("keyboard");
};
