// Circle Through Incenter 2: a drawing, not a game. Show two different
// configurations of the triangle and the circle through A, I and B.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-through-incenter-2
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

  // Configuration 1: the applet's opening triangle, tilted, with the two
  // marked lengths and the hint (the dashed antiparallel chord and J).
  await page.click("#statement");
  await page.click("#hint");
  await drag(2, { x: 330, y: 95 }); // C
  log("configuration 1:", await text("#status"));
  await shot("equal-lengths");

  // Configuration 2: reset, then the bisectors option on a different
  // triangle; X falls on the side and Y beyond the corner here.
  await page.click("#resetBtn");
  await page.click("#statement");
  await page.click("#hint");
  await page.click("#premises");
  await drag(0, { x: 120, y: 45 }); // A
  await drag(1, { x: 340, y: 235 }); // B
  await drag(2, { x: 235, y: 60 }); // C
  log("configuration 2:", await text("#status"));
  await shot("bisectors");

  if (!first) return;
  // Press every remaining control, and check keyboard movement keeps focus.
  await page.click("#names");
  await page.click("#names");
  await page.click("#premises");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await idle();
  const focus = await page.evaluate(() =>
    document.activeElement?.classList.contains("geom-handle"));
  log("keyboard focus on board after a move:", focus);
  if (!focus) throw new Error("focus left the board after an arrow-key move");
};
