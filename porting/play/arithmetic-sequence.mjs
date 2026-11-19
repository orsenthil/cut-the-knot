// Arithmetic Sequence: the eight/nine choice, keyboard toggles, every button,
// and a word-for-word account of what changed. Run:
// NODE_PATH=$(npm root -g) node porting/play.mjs arithmetic-sequence
export default async ({ page, first, log, shot, idle, text }) => {
  const status = () => text("#status");
  const groups = () => text("#groups");
  const focus = () =>
    page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains("cell")
        ? "cell " + document.activeElement.dataset.index
        : "not on the board",
    );

  // Initial state: the applet opens with eight numbers and all boxes Off.
  log("initial status:", await status());
  log("initial groups:", await groups());
  await shot("initial");
  if (!first) return; // the dark run only needs the same first screenshots

  // Every option to its maximum: play with nine numbers.
  await page.click("#btn9");
  log("maximum option (9 numbers):", await status());
  log("groups at 9:", await groups());
  await shot("maximum");

  // Two moves with the keyboard alone, then check focus is still on the board.
  await page.locator('.cell[data-index="0"]').focus();
  log("focus before keyboard moves:", await focus());
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log("after Enter then Right then Enter:", await status());
  log("focus after keyboard moves:", await focus());
  log("groups after keyboard moves:", await groups());
  await shot("keyboard");

  // Press every button a player would, in order: the two options, the nine
  // number boxes, then the primary Clear all button.
  await page.click("#btn8");
  log("chose 8 numbers:", await status(), "|", await groups());
  await page.click("#btn9");
  log("chose 9 numbers:", await status(), "|", await groups());
  for (let i = 0; i < 9; i++) {
    await page.click(`.cell[data-index="${i}"]:not(:disabled)`);
    log(`switched number ${i + 1}:`, await status());
  }
  await shot("all-buttons");

  await page.click("#newBtn");
  log("after Clear all:", await status(), "|", await groups());
  await shot("cleared");

  // Both extremes, and back again: the ninth box leaves and re-enters play.
  await page.click("#btn8");
  const off9 = await page.locator('.cell[data-index="8"]').isDisabled();
  log("minimum option (8): number 9 disabled:", off9, "|", await status());
  await shot("minimum");
  await page.click("#btn9");
  const on9 = await page.locator('.cell[data-index="8"]').isEnabled();
  log("maximum option (9): number 9 enabled:", on9, "|", await status());
  await shot("maximum-again");

  log(
    "in words: changing 8 to 9 brings number 9 into play; switching a box " +
      "moves that number between the On and Off groups; when three evenly " +
      "spaced numbers share a group the status names them and the demo is done; " +
      "Clear all puts every box back to Off.",
  );
};
