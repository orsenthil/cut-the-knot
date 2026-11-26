// Antiparallel: a drawing, not a game. Move the triangle and the circle's
// centre to two different configurations, showing the equal angles and then
// a cut past a corner. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs antiparallel
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

  // Configuration 1: a tall triangle, the circle's centre still above AB.
  await page.click("#hint");
  await drag(2, { x: 236, y: 32 }); // C
  await drag(3, { x: 200, y: 168 }); // P, snapped onto the dashed axis
  log("configuration 1:", await text("#status"));
  await shot("equal-angles");

  // Configuration 2: reset, then a tilted triangle with P below AB, so one
  // of the cuts falls on an extension of a side.
  await page.click("#resetBtn");
  await page.click("#hint"); // off
  await page.click("#names"); // off
  await page.click("#names"); // and back on
  await drag(0, { x: 70, y: 250 }); // A
  await drag(1, { x: 330, y: 200 }); // B
  await drag(3, { x: 191, y: 176 }); // P, toward C so the cuts pass the corners
  log("configuration 2:", await text("#status"));
  await shot("extension");

  if (!first) return;
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
