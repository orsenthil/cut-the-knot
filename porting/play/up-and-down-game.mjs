// Monotone Number Sequences: fill the nine boxes with a board that has no
// four-chain (a win), then fill ten boxes in order (an unavoidable loss).
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs up-and-down-game

const WIN_BOARD = [3, 2, 1, 6, 5, 4, 9, 8, 7]; // box i receives this number

export default async ({ page, first, log, shot, text }) => {
  const place = async (value, box) => {
    await page.click(`.tile[data-value="${value}"]`);
    await page.click(`.box[data-box="${box}"]`);
  };
  const count = async (selector) => page.locator(selector).count();
  const setLength = async (n) => {
    await page.click(`input[name="length"][value="${n}"]`);
    await page.click("#newBtn");
  };

  // ---- a win: three falling groups of three ----
  await setLength(9);
  for (let box = 0; box < WIN_BOARD.length; box++) await place(WIN_BOARD[box], box);
  log("nine, no four-chain:", await text("#status"));
  await shot("win");

  if (first) {
    // Every button in order: New Game, both length options, then a keyboard play.
    await page.click("#newBtn");
    await page.focus('.tile[data-value="1"]');
    await page.keyboard.press("Enter"); // pick up number 1: focus moves to a box
    await page.keyboard.press("Enter"); // place it in that box
    await page.focus('.tile[data-value="2"]');
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.getAttribute("aria-label") || el.tagName : "none";
    });
    log("after two keyboard moves, focus is on:", focused);
    log("keyboard board:", await page.evaluate(() =>
      [...document.querySelectorAll(".box")].map((b) => b.textContent || "_").join(" ")));
    await shot("keyboard");

    // The same placement by dragging a number onto a box.
    await page.click("#newBtn");
    await page.locator('.tile[data-value="5"]').dragTo(page.locator('.box[data-box="0"]'));
    log("after dragging number 5 onto box 1:", await page.evaluate(() =>
      document.querySelector('.box[data-box="0"]').textContent || "empty"));
    await shot("drag");

    // A faulty partial board is pointed out, without ending the play.
    await page.click("#newBtn");
    for (let box = 0; box < 4; box++) await place(box + 1, box);
    log("four rising numbers:", await text("#status"));
    log("highlighted boxes:", await count(".box.faulty"));
    await shot("faulty");

    // Both option directions: 9 -> 10 -> 9, with the right board size.
    await page.click('input[name="length"][value="10"]');
    log("after choosing ten:", await count(".box"), "boxes,", await count(".tile"), "numbers");
    await page.click('input[name="length"][value="9"]');
    log("after choosing nine:", await count(".box"), "boxes,", await count(".tile"), "numbers");
  }

  // ---- a loss: ten numbers in order must contain a rising four-chain ----
  await setLength(10);
  for (let box = 0; box < 10; box++) await place(box + 1, box);
  log("ten in order:", await text("#status"));
  log("highlighted boxes:", await count(".box.faulty"));
  await shot("loss");
};
