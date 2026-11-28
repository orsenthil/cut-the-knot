// Light House: a demo, so the two configurations stand in for a win and a
// loss. First the applet's default three-beam triangle; then six beams with
// opposite speeds and a run of the animation. The keyboard, every button and
// both directions of every slider are exercised on the light run.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs light-house

export default async ({ page, first, log, shot, text, idle }) => {
  const setRange = (id, value) => page.locator(id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  const setCheck = async (id, on) => {
    if (await page.isChecked(id) !== on) await page.click(id);
  };
  log("initial:", await text("#status"));
  const count = async (sel) => page.locator(sel).count();
  log("triangle path, rays and handles:", await count("#board .poly"),
    await count("#board .ray"), await count("#board .geom-handle"));
  await shot("three-beam-triangle");

  if (first) {
    // Two keyboard moves on a lighthouse; focus must stay on the board.
    await page.locator('[aria-label^="First lighthouse"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    log("two arrow keys:", await text("#status"));
    log("focus kept:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
    await page.keyboard.press("Home");
  }

  // Configuration 2: six beams, opposite speeds, polygon plus extended sides.
  await setRange("#nInput", 6);
  await setRange("#rate1Input", 2);
  await setRange("#rate2Input", -1);
  await setCheck("#extendChk", true);
  await setCheck("#fillChk", true);
  log("six beams:", await text("#status"));
  log("rays and polygons:", await count("#board .ray"), await count("#board .poly"),
    "extended:", await count("#board .extended"));
  await shot("six-beam-hexagons");

  // The animation: Go turns the beams, Step turns them once, Stop halts them.
  await page.click("#goBtn");
  await idle(() => Number(document.querySelector("#rate1Value")?.textContent) === 2);
  await page.waitForTimeout(450);
  log("after Go:", await page.getAttribute("#goBtn", "aria-label"), "|", await text("#status"));
  await page.click("#goBtn");
  await page.click("#stepBtn");
  log("after Step:", await text("#status"));
  await shot("after-turning");

  // Press and reverse every remaining control.
  await setCheck("#fillChk", false);
  await setCheck("#extendChk", false);
  await setCheck("#polyChk", false);
  log("polygon off:", await text("#status"));
  await setCheck("#polyChk", true);
  await setCheck("#beamsChk", false);
  log("beams off:", await text("#status"));
  await setCheck("#beamsChk", true);
  log("asymptotes disabled at different speeds:", await page.isDisabled("#asyChk"));
  await setRange("#rate2Input", 2);
  await setCheck("#polyChk", true);
  log("same speeds, polygon on, asymptotes available:",
    await page.isDisabled("#asyChk"), "|", await text("#status"));
  await setCheck("#polyChk", false);
  await setRange("#nInput", 1);
  log("one beam:", await text("#status"));
  await setRange("#nInput", 12);
  log("twelve beams:", await text("#status"));
  await setRange("#rate1Input", -12);
  await setRange("#rate2Input", 12);
  log("full speed range:", await text("#status"));
  await setCheck("#polyChk", true);
  await setCheck("#fillChk", false);
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("after-reset");
};
