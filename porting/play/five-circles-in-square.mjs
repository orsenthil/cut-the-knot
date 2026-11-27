// Five Incircles in Square: two configurations, the starting one and the
// applet's equal-radii answer. Run with:
//   export NODE_PATH=$(npm root -g); node porting/play.mjs five-circles-in-square
export default async ({ page, first, log, shot, text }) => {
  log("starting diagram:", await text("#status"));
  await shot("start");

  if (first) {
    log("hint disabled at the start:", await page.isDisabled("#hintChk"));
    log("statement disabled at the start:", await page.isDisabled("#statementChk"));

    // Two keyboard moves on the E handle: focus must stay on the board.
    const handle = page.locator("#board .geom-handle");
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    log("after two arrow keys:", await text("#status"));
    log("focus still on E:", await handle.evaluate((el) => el === document.activeElement));
    await shot("keyboard");
  }

  await page.click("#equalBtn");
  log("all five equal:", await text("#status"));
  if (first) {
    log("hint enabled at the answer:", !(await page.isDisabled("#hintChk")));
    await page.check("#hintChk");
    await page.check("#statementChk");
    await page.check("#namesChk");
    log("with hint and statement:", await text("#status"));
  }
  await shot("equal");

  if (first) {
    await page.click("#resetBtn");
    log("after New diagram:", await text("#status"));
    await shot("reset");
  }
};
