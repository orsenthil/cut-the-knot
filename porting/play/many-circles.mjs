// Many Circles: a drawing, not a game. Move a centre at the default three
// circles, then turn the spinner up to ten circles and move a corner; finish
// with two arrow keys on a focused handle so keyboard play is visible.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs many-circles
export default async ({ page, first, log, shot, idle, text }) => {
  const boardPoint = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handleAt = (selector, i) => page.evaluate(([sel, idx]) => {
    const h = [...document.querySelectorAll(sel)][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, [selector, i]);

  const drag = async (selector, i, to) => {
    const from = await handleAt(selector, i);
    const a = await boardPoint(from.x, from.y);
    const b = await boardPoint(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: three circles, centre of circle 1 pulled down and left.
  await drag(".center-handle", 0, { x: 232, y: 168 });
  log("three circles:", await text("#status"));
  await shot("three-circles");

  // Configuration 2: the largest setting, then choose a new first corner.
  await page.fill("#count", "10");
  await page.locator("#count").dispatchEvent("change");
  await drag(".vertex-handle", 0, { x: 318, y: 100 });
  log("ten circles:", await text("#status"));
  await shot("ten-circles");

  if (!first) return;

  // Keyboard alone: a focused corner must still own the focus afterwards.
  await page.evaluate(() => document.querySelectorAll(".vertex-handle")[1].focus());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("after arrow keys:", await text("#status"));
  log("focus kept on the corner:", await page.evaluate(() =>
    document.activeElement === document.querySelectorAll(".vertex-handle")[1]));

  // Press the other button in a player's order, and put the spinner back.
  await page.click("#resetBtn");
  await page.fill("#count", "3");
  await page.locator("#count").dispatchEvent("change");
  log("after reset:", await text("#status"));
};
