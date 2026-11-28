// Hermann: two configurations of the grid illusion, one gaze inspection and
// one dense inverted grid. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hermann
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = (selector, value) => page.evaluate(([sel, v]) => {
    const input = document.querySelector(sel);
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [selector, value]);

  // First configuration: the applet's opening 4-by-4 rectangles at Part 50.
  log("opening:", await text("#status"));
  await shot("opening-halo");
  await page.focus("#board .geom-handle");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
  await idle();
  log("gaze on a gap:", await text("#status"));
  log("focus after arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("class")));
  await shot("rectangles-gaze");

  // Second configuration: reset, then push both sliders past their ends and
  // back, try both shape buttons, switch colours, and make a dense circle grid.
  await page.click("#resetBtn");
  await setRange("#nInput", 99);
  await setRange("#nInput", -3);
  await setRange("#partInput", 200);
  await setRange("#partInput", -7);
  log("after clamping both sliders:", await text("#status"),
    "| N:", await page.inputValue("#nInput"), "| Part:", await page.inputValue("#partInput"));
  await setRange("#nInput", 8);
  await setRange("#partInput", 75);
  await page.click("#rectBtn");
  await page.click("#ovalBtn");
  await page.click("#switchBtn");
  log("eight-by-eight circles, inverted:", await text("#status"));
  await page.focus("#board .geom-handle");
  for (let i = 0; i < 20; i++) await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 24; i++) await page.keyboard.press("Shift+ArrowDown");
  await idle();
  log("gaze moved away:", await text("#status"));
  await shot("circles-dense-inverted");

  if (first) {
    await page.click("#switchBtn");
    await page.click("#rectBtn");
    await page.click("#resetBtn");
    log("after Reset:", await text("#status"));
  }
};
