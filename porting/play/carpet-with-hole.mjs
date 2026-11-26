// Carpet With Hole: the opening 9x12 carpet with its hole, then the two
// pieces slid together into a 10x10 square (pointer, then keyboard), plus the
// largest size and the grid switch. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs carpet-with-hole
export default async ({ page, first, log, shot, text }) => {
  const dragTo = async (label, bx, by) => {
    const h = await page.locator(`#board circle[aria-label^="${label}"]`).boundingBox();
    if (!h) throw new Error(`cannot find handle ${label}`);
    const at = await page.evaluate(([x, y]) => {
      const m = document.getElementById("board").getScreenCTM();
      const p = new DOMPoint(x, y).matrixTransform(m);
      return { x: p.x, y: p.y };
    }, [bx, by]);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x, at.y, { steps: 12 });
    await page.mouse.up();
  };

  // Configuration 1: the applet's opening picture, grid on, hole in the middle.
  log("opening:", await text("#status"));
  await shot("opening-carpet");

  if (!first) return; // the dark run only needs the two screenshots below

  // The largest radio size, 15x18: every control must still fit at 375px.
  await page.click('.nxBtn[data-nx="18"]');
  log("largest size:", await text("#status"));
  await shot("largest-size");

  await page.click('.nxBtn[data-nx="12"]');

  // Configuration 2: slide the right piece two cells left and one cell up;
  // the core snaps it and the two pieces become a 10x10 square.
  await dragTo("Piece B", 80, 40);
  log("piece B now:", await page.locator('#board circle[aria-label^="Piece B"]').getAttribute("aria-label"));
  log("after sliding the right piece:", await text("#status"));
  await shot("square");

  // Now the left piece, using the keyboard only; focus must survive each move.
  await page.click("#resetBtn");
  await page.locator('#board circle[aria-label^="Piece A"]').focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("ArrowDown");
  log("after keyboard slide:", await text("#status"));
  log("focus kept:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));
  await shot("keyboard-square");

  // Grid switch and Reset, as a player would press them.
  await page.click("#gridBox");
  log("grid off:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
