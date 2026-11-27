// Two configurations of Equal Areas in Equilateral Triangle: the default
// picture, then M near a corner with names and the proof hint switched on.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equal-areas-in-equilateral-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  log("starting picture:", await text("#status"));
  await shot("start");

  const client = (x, y) => page.evaluate(([px, py]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const from = await page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });
  const a = await client(from.x, from.y);
  const b = await client(245, 125);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await idle();

  await page.check("#hintBox");
  await page.check("#namesBox");
  log("after dragging M and switching on hint:", await text("#status"));
  await shot("hint");

  if (!first) return;

  // Keyboard only: move M back towards the middle, and check the focus stays.
  await page.locator("#board .geom-handle").focus();
  for (const key of ["ArrowLeft", "ArrowDown", "ArrowLeft"]) {
    await page.keyboard.press(key);
  }
  log("after three arrow keys:", await text("#status"));
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("class"));
  log("focus after arrow keys:", focus);
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
