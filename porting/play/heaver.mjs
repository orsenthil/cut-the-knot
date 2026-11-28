// Heaver: two configurations of the illusion. This port is a demo, so there
// is no win or loss — the scenarios show the square's apparent swell and the
// six-triangle hexagon, then exercise every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs heaver
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = async (sel, value) => {
    await page.locator(sel).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await idle("#board .geom-handle");
  await page.click("#playBtn"); // pause so each screenshot shows a fixed step
  log("opening:", await text("#status"));
  await shot("opening");

  // 1. Four square covers, opening 13: the visible height is largest at step
  // 25 (an eighth of a turn) and smallest at step 0.
  await setRange("#frameRange", 25);
  log("square swelled:", await text("#status"));
  await shot("square-swell");
  await setRange("#gapRange", 0);
  log("smallest opening:", await text("#status"));
  await shot("narrow-gap");
  await setRange("#gapRange", 80);
  log("widest opening:", await text("#status"));
  await shot("wide-gap");

  // 2. Six triangle covers forming a hexagon around a turning triangle, with
  // semi-transparent covers and a larger gap.
  await page.check('input[name="occlusion"][value="2"]');
  await page.check('input[name="object"][value="1"]');
  await setRange("#gapRange", 40);
  await setRange("#opacityRange", 180);
  await setRange("#frameRange", 75);
  log("hexagon and triangle:", await text("#status"));
  await shot("hexagon-triangle");

  if (!first) return; // the dark run only needs the two configurations above

  // Keyboard only: two arrow presses on the scrub handle; focus must stay.
  // Starting at step 0 puts the handle to the right of the centre, where an
  // upward press visibly changes the step instead of rounding back to it.
  await setRange("#frameRange", 0);
  await page.locator("#board .geom-handle").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrows:", await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || ""));
  log("after keyboard:", await text("#status"));
  await shot("keyboard");

  // Every option both ways, the other buttons, then a final Reset.
  for (const value of ["3", "1", "0", "2"]) await page.check(`input[name="occlusion"][value="${value}"]`);
  for (const value of ["4", "3", "2", "1", "0"]) await page.check(`input[name="object"][value="${value}"]`);
  await setRange("#speedRange", 200);
  await setRange("#speedRange", 0);
  await setRange("#opacityRange", 0);
  await setRange("#opacityRange", 255);
  await page.click("#stepBtn");
  log("after Step:", await text("#status"));
  await page.click("#playBtn");
  await idle(() => !/step 0 of 200/.test(document.querySelector("#status")?.textContent || ""));
  log("after Play:", await text("#status"));
  await page.click("#playBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
