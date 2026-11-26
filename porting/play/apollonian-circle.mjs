// Apollonian Circle: a drawing, not a game. Move A, B and the ratio to two
// different configurations, showing the locus circle and then its inversion.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs apollonian-circle
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

  const ratio = async (value) => {
    await page.evaluate((v) => {
      const el = document.getElementById("ratio");
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await idle();
  };

  // Configuration 1: ratio above 1, A and B dragged into a slanted line.
  await ratio(2);
  await drag(0, { x: 72, y: 218 });
  await drag(1, { x: 252, y: 118 });
  log("configuration 1:", await text("#status"));
  await shot("ratio-two");
  if (!first) return; // the dark run only needs the first screenshot

  // Configuration 2: reset, ratio below 1, with the inversion construction.
  await page.click("#resetBtn");
  await page.click("#hint"); // off, then back on: the applet starts with it on
  await page.click("#hint");
  await page.click("#extra");
  await ratio(0.6);
  await drag(0, { x: 122, y: 108 });
  await drag(1, { x: 262, y: 222 });
  await drag(2, { x: 62, y: 108 });
  log("configuration 2:", await text("#status"));
  await shot("ratio-below-one");
  log("reset:", await (async () => { await page.click("#resetBtn"); return await text("#status"); })());
};
