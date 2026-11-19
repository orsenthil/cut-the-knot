// Box Volume: explore the sliders, then press every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs box-volume
export default async ({ page, first, log, shot, text }) => {
  const setRange = async (id, value) => {
    await page.$eval(id, (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  log("initial:", await text("#status"));
  await shot("initial");

  // Every option at its maximum. With a = b = 20 the cut of 10 is exactly
  // half the shorter side, so the base vanishes and the volume is zero.
  await setRange("#aInput", 20);
  await setRange("#bInput", 20);
  await setRange("#xInput", 10);
  log("all options at maximum:", await text("#status"));
  await shot("max");

  // Both extremes of the sliders: smallest sheet and no cut at all.
  await setRange("#aInput", 2);
  await setRange("#bInput", 2);
  await setRange("#xInput", 0);
  log("all options at minimum:", await text("#status"));
  log("x slider max now:", await page.$eval("#xInput", (el) => el.max));

  // Back to the page's example, then two keyboard-only moves on the canvas.
  await setRange("#aInput", 11);
  await setRange("#bInput", 8.5);
  await setRange("#xInput", 1);
  await page.focus("#boxCanvas");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
  log("focus after two arrow keys:", focus);
  if (first && focus !== "boxCanvas") throw new Error(`focus left the canvas: ${focus}`);
  log("after two keyboard moves:", await text("#status"));
  await shot("keyboard");

  // Press every button in the order a player would.
  await page.click("#findBtn");
  log("after Find the best cut:", await text("#status"));
  await shot("best");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
