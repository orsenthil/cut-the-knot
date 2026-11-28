// Hanner: an illustrated jigsaw, not a game. Configuration 1 is the right
// triangle the applet starts from, with the guide on and the five pieces
// tiled. Configuration 2 frees C from its circumcircle and moves it by hand,
// so the pieces miss the squares. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs hanner
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const client = (p) => page.evaluate((q) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f };
  }, p);

  const drag = async (i, to) => {
    const from = await handlePos(i);
    const a = await client(from), b = await client(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: the applet's right triangle and the solved dissection.
  await page.click("#hint");
  log("configuration 1 (right triangle):", await text("#status"));
  await shot("tiled");

  // Configuration 2: release C from the circle, then move it with the arrow
  // keys (a new mouse grab would put it back on the circle) until the right
  // angle breaks. The pieces no longer fill the squares.
  await page.click("#freeBtn");
  await page.focus("#board .geom-handle:nth-of-type(3)");
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  await idle();
  log("configuration 2 (freed C):", await text("#status"));
  await shot("skewed");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard moves keep focus on the handle after the geometry changes;
  // then press every control in both directions.
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("geom-handle"));
  log("after two arrow keys, focus still on a handle:", focused);

  await page.click("#hint");
  await page.click("#hint");
  await page.click("#freeBtn");
  await page.click("#resetBtn");
  await drag(0, { x: 150, y: 270 });
  await drag(1, { x: 370, y: 260 });
  log("after both toggles, reset and two drags:", await text("#status"));
};
