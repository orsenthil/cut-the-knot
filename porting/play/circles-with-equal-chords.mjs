// Circles With Equal Chords: show a solved configuration, then drag the
// second radius in until no equal-chord line exists. No win or loss: this is
// an illustration, so both screenshots are the two configurations.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-with-equal-chords
export default async ({ page, first, log, shot, text }) => {
  await page.click("#hintCheck");
  await page.click("#namesCheck");

  // Keyboard only: slide L down and check focus stays on the board handle.
  await page.focus("#handle-L1");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  log("first configuration:", await text("#status"));
  await shot("equal-chords");

  // Shrink the second circle until C(T) no longer crosses it.
  await page.focus("#handle-R2");
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowLeft");
  if (first) {
    const at = await page.evaluate(() => ({
      focused: document.activeElement && document.activeElement.id,
      r2x: document.getElementById("handle-R2").getAttribute("cx"),
    }));
    log("after keyboard moves:", JSON.stringify(at));
  }
  log("second configuration:", await text("#status"));
  await shot("no-solution");

  if (!first) return; // dark run has both screenshots already
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
