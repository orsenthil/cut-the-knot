// ABOn Circumcircle: a drawing, not a game. Drag the triangle to two
// different shapes, showing the right-angle marks and then the angle hint.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ab-on-circumcircle
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const drag = async (i, to) => {
    const from = await handlePos(i);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: a scalene triangle with the right-angle corners shown.
  await page.click("#statement");
  await page.click("#names"); // off
  await page.click("#names"); // and back on
  await drag(1, { x: 138, y: 244 });
  await drag(2, { x: 340, y: 190 });
  log("configuration 1:", await text("#status"));
  await shot("right-angle");

  // Configuration 2: reset, then a tall triangle with the angle hint shown.
  await page.click("#resetBtn");
  await page.click("#statement"); // off
  await page.click("#hint");      // on
  await drag(0, { x: 226, y: 38 });
  await drag(1, { x: 62, y: 232 });
  await drag(2, { x: 348, y: 246 });
  log("configuration 2:", await text("#status"));
  await shot("angle-hint");

  if (!first) return;
  log("reset status:", await (async () => {
    await page.click("#resetBtn");
    return await text("#status");
  })());
};
