// Arbelos Bui: a drawing, not a game. Drag the dividing point into two very
// different arbeloses, showing the equal radii in one and the parallel hint
// in the other, then move the point with the keyboard alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs arbelos-bui
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
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: C far to the left; small r1, large r2, names and the
  // equal-distance strokes on.
  await page.click("#names");  // off
  await page.click("#names");  // back on
  await page.click("#proposition");
  await drag(2, { x: 120, y: 208 });
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: reset, large r1 and small r2, with the parallel hint.
  await page.click("#resetBtn");
  await page.click("#proposition"); // off
  await page.click("#hint");        // on
  await page.click("#names");       // off
  await drag(2, { x: 330, y: 208 });
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  // Keyboard alone: focus C, press two arrow keys, and keep the focus there.
  await page.evaluate(() => {
    document.querySelectorAll("#board .geom-handle")[2].focus();
  });
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after arrow keys:", await text("#status"));
  log("focus kept on C:", await page.evaluate(() => {
    const h = document.querySelectorAll("#board .geom-handle")[2];
    return document.activeElement === h;
  }));
  await shot("keyboard");

  if (!first) return;
  await page.click("#hint"); // off
  await page.click("#names"); // back on
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
