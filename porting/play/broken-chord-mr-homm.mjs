// Broken Chord Mr Homm: an illustration, not a game. Show two different
// triangle shapes, one with the proof hint on and one with just the names.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs broken-chord-mr-homm
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
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // Keyboard alone first: two arrow presses must leave focus on the board.
  if (first) {
    await page.focus("#board .geom-handle");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() =>
      document.activeElement?.classList.contains("geom-handle"));
    log("keyboard focus kept:", focused);
    if (!focused) throw new Error("focus left the board after arrow keys");
  }

  // Configuration 1: a wide triangle with AC the long side; the hint draws
  // Q, F and the equal-length/angle marks from Anderson's proof.
  await page.click("#hint");
  await drag(1, { x: 292, y: 118 });
  await drag(2, { x: 232, y: 46 });
  log("hint configuration:", await text("#status"));
  await shot("hint-proof");

  // Configuration 2: reset, then a tall triangle where BC is the long side.
  await page.click("#resetBtn");
  await page.click("#hint"); // off
  await page.click("#names"); // off
  await page.click("#names"); // and back on
  await drag(0, { x: 112, y: 180 });
  await drag(1, { x: 334, y: 172 });
  await drag(2, { x: 150, y: 60 });
  log("second configuration:", await text("#status"));
  await shot("long-side");

  if (!first) return;
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
