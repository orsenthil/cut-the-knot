// Angle Bisector in an Equilateral Trapezoid: an illustration, not a game.
// Drag to two different trapezoids/G positions and take a screenshot of each.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-bisector-in-equilateral-trapezoid
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

  // Configuration 1: the special case. The hint unlocks only here.
  await page.click("#bisectorBtn");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names"); // and back on
  log("on the bisector:", await text("#status"));
  log("hint available:", await page.isEnabled("#hint"));
  await shot("bisector");

  if (!first) return; // the dark run only needs the first screenshot

  // Configuration 2: reset, drag G away, then change the trapezoid itself
  // in both modes, ending with a different circle and G back on the board.
  await page.click("#resetBtn");
  await page.click("#offBtn");
  log("off the bisector:", await text("#status"));
  await page.click('input[name="mode"][value="free"]');
  await drag(1, { x: 250, y: 175 }); // B, with A mirrored
  await drag(3, { x: 120, y: 60 });  // D, with C mirrored
  await page.click('input[name="mode"][value="circle"]');
  await drag(4, { x: 170, y: 110 }); // G inside triangle BCD
  log("changed trapezoid:", await text("#status"));
  log("hint available:", await page.isEnabled("#hint"));
  await shot("changed");

  await page.click("#bisectorBtn");
  log("back on the bisector:", await text("#status"));
  await page.click("#hint"); // turn the hint back off
  await page.click("#offBtn");
  log("hint available again:", await page.isEnabled("#hint"));
};
