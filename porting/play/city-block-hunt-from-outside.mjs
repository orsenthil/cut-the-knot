// City Block Hunt From Outside is a demo: set N to its maximum, make keyboard
// moves with a focus check, press every button, drive N to both extremes, then
// take one outside clue and hunt down the treasure. After the find, one more
// touch is refused (the page says the game stops). The status line says in
// words what each touch changed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs city-block-hunt-from-outside
export default async ({ page, first, log, shot, text }) => {
  const squares = () => page.locator("button.cell.square").count();
  const done = () => page.locator("#status.done").count();
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));

  log("initial:", await text("#status"));
  await shot("start");

  // Every option at its largest value: N = 8 (the applet's spinner maximum)
  // and Show hint on.
  await page.locator("#nSpin").fill("8");
  await page.locator("#hintChk").check();
  log("N at maximum (8), hint on:", await squares(), "grid squares");
  await shot("max-options");

  // Two keyboard moves on the board and a keyboard touch; focus stays on it.
  await page.focus('button.cell[data-col="0"][data-row="0"]');
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("keyboard touch:", await text("#status"), "| focus:", await focus());
  await shot("keyboard");

  // Press the remaining control in player order: New Game (Show hint was
  // already switched on above; toggling it back off and on also works).
  await page.click("#newBtn");
  log("after New Game:", await text("#status"));
  await page.locator("#hintChk").uncheck();
  log("after Show hint off:", await text("#status"));
  await page.locator("#hintChk").check();
  log("after Show hint on:", await text("#status"));

  // N at both extremes, including values outside the spinner's range.
  await page.locator("#nSpin").fill("2");
  log("N at minimum (2):", await squares(), "grid squares");
  await shot("min-options");
  await page.locator("#nSpin").fill("99");
  log("N after a high value (clamped to 8):", await squares(), "grid squares");
  await page.locator("#nSpin").fill("1");
  log("N after a low value (clamped to 2):", await squares(), "grid squares");
  await shot("clamped-options");

  // Play: one clue from outside, then every interior square until the find.
  await page.locator("#nSpin").fill("4");
  await page.click('button.cell[data-col="-1"][data-row="0"]');
  log("after an outside touch:", await text("#status"));
  await shot("clue");
  for (let row = 0; row < 4 && !(await done()); row++) {
    for (let col = 0; col < 4 && !(await done()); col++) {
      await page.click(`button.cell[data-col="${col}"][data-row="${row}"]`);
    }
  }
  log("after a win:", await text("#status"));
  await shot("win");

  if (!first) return; // the dark run only needs the screenshots above

  // Dead end: the hunt is over, so a further touch is refused.
  await page.click('button.cell[data-col="3"][data-row="3"]');
  log("after a further touch:", await text("#status"));
  await shot("dead-end");
};
