// Happy 8: two scrambled configurations, one at the default size and one at
// the applet's largest size. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs happy-8
export default async ({ page, first, log, shot, text }) => {
  const handle = (i) => page.locator("#board .h8-handle").nth(i);
  const seats = (await text("#status"));

  // Configuration 1: eight counters. l, w and r are the first three controls
  // in the applet's hit-test order: lower-left, upper middle, lower-right.
  log("start:", seats);
  await handle(0).click(); // l: left circle counterclockwise
  await handle(2).click(); // w: whole set counterclockwise
  await handle(1).click(); // r: right circle counterclockwise
  log("after l, w, r:", await text("#status"));
  await shot("eight");

  if (first) {
    // Keyboard: focus a control and press an arrow key twice; focus must stay.
    await handle(3).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
    log("keyboard focus kept:", focused);
    // Every button and the option, in the order a player would use them.
    await page.click("#shuffleBtn");
    log("after Shuffle:", await text("#status"));
    await page.click("#cheatBtn");
    log("after Cheat:", await text("#status"));
    await page.click("#cyclesBox");
    log("with Cycles:", await text("#status"));
    await page.click("#lessBtn");
    log("fewer counters:", await text("#countLabel"));
    await page.click("#moreBtn");
    log("more counters:", await text("#countLabel"));
    await page.click("#resetBtn");
    log("after Reset:", await text("#status"));
  }

  // Configuration 2: the largest size the applet's ">" button allows, with
  // the cycle hint on and two more turns made.
  await page.click("#moreBtn");
  await page.click("#moreBtn");
  await page.click("#moreBtn");
  if (!(await page.isDisabled("#moreBtn"))) throw new Error("the > button should stop at 14");
  if (!(await page.isChecked("#cyclesBox"))) await page.click("#cyclesBox");
  await handle(3).click(); // L: left circle clockwise
  await handle(0).click(); // l: left circle counterclockwise
  log("after L and l at 14:", await text("#status"), "|", await text("#countLabel"));
  await shot("fourteen");
};
