// Areas In Square: the original N=2 puzzle, then N=5 with the dissection
// shown, then drag E, resize the square, use the keyboard and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs areas-in-square
export default async ({ page, first, log, shot, text }) => {
  const boardBox = await page.locator("#board").boundingBox();
  const dragTo = async (label, x, y) => {
    const h = await page.locator(`#board circle[aria-label^="${label}"]`).boundingBox();
    if (!h || !boardBox) throw new Error(`cannot find handle ${label} or the board`);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox.x + (x / 400) * boardBox.width,
      boardBox.y + (y / 400) * boardBox.height, { steps: 12 });
    await page.mouse.up();
  };

  log("opening:", await text("#status"));
  await shot("n2-opening");

  await page.click("#colorsBox");
  await page.click("#dissectionBox");
  log("N=2 with colours and dissection:", await text("#status"));
  await shot("n2-dissection");

  // The applet's spinner goes 2..20 in steps of one.
  await page.fill("#nInput", "5");
  await page.locator("#nInput").press("Tab");
  log("N=5:", await text("#status"));
  await shot("n5-dissection");

  if (!first) return; // the dark run has both configurations already

  // Slide E towards the midpoint: N falls to 3.
  await dragTo("Point E", 20, 260);
  log("after dragging E (N=3):", await text("#status"));
  await shot("drag-e");

  // Two shift+arrow presses on the same handle keep focus and move E far
  // enough to change N from 3 to 2.4 (the grid hides for a fractional N).
  await page.locator('#board circle[aria-label^="Point E"]').focus();
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+ArrowUp");
  log("after two arrow keys:", await text("#status"));
  log("focus kept:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));

  // Resize the square by its top-right corner; the ratios must not move.
  await dragTo("Corner C", 330, 70);
  log("after resizing:", await text("#status"));
  await shot("resized");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
