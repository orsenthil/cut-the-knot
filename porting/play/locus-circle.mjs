// Locus Circle: a drawing, not a game. Show the locus circle with two unequal
// spinner numbers, then the perpendicular bisector when the numbers match.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs locus-circle
export default async ({ page, first, log, shot, idle, text }) => {
  const setCount = async (id, value) => {
    await page.evaluate(([elId, v]) => {
      const el = document.getElementById(elId);
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, [id, value]);
    await idle();
  };

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

  // Configuration 1: NB=4, NC=3 on the applet's own level AB, with the
  // construction lines and M, N shown.
  await setCount("nb", 4);
  await setCount("nc", 3);
  await page.click("#hint");
  await page.click("#names");
  log("configuration 1:", await text("#status"));
  await shot("circle-ratio-four-thirds");
  if (!first) return; // the dark run only needs the first screenshot

  // Configuration 2: equal numbers, a slanted AB, and the full circle shown.
  await setCount("nc", 4);
  await page.click("#resetBtn");
  await drag(0, { x: 70, y: 220 });
  await drag(1, { x: 290, y: 110 });
  log("configuration 2:", await text("#status"));
  await shot("equal-numbers-bisector");

  // The keyboard path: focus P and move it twice with the arrow keys.
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("#board .geom-handle")][2];
    h.focus();
  });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("after two arrow keys:", await text("#status"));
  log("reset:", await (async () => { await page.click("#resetBtn"); return await text("#status"); })());
};
