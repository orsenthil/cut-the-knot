// Circle Through Circumcenter: a drawing, not a game. Drag the triangle to
// two different shapes, showing the right angle and then the angle hint.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-through-circumcenter
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

  // Configuration 1: a scalene triangle with the right angle at X shown.
  await page.click("#hint");      // off
  await page.click("#statement"); // on
  await drag(1, { x: 122, y: 66 });
  await drag(2, { x: 330, y: 232 });
  log("configuration 1:", await text("#status"));
  await shot("right-angle");

  // Configuration 2: reset, then a wide obtuse triangle with the angle hint
  // and the radii to the side midpoints shown.
  await page.click("#resetBtn");
  await page.click("#statement"); // off
  await page.click("#hint");      // on
  await page.click("#premises");  // on
  await drag(0, { x: 208, y: 40 });
  await drag(1, { x: 58, y: 244 });
  await drag(2, { x: 352, y: 250 });
  log("configuration 2:", await text("#status"));
  await shot("hint-premises");

  if (!first) return;
  await page.click("#names"); // off: a clean picture with no point labels
  log("names off:", await text("#status"));
  await shot("no-names");
};
