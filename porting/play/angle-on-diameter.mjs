// Angle On Diameter: a drawing, not a game. Drag P to two positions, showing
// the marked right angle first and then the isosceles-triangle angle hint.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-on-diameter
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragP = async (to) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: P low on the left, with the right-angle square marked.
  await page.check('input[name="mode"][value="statement"]');
  await dragP({ x: 113, y: 200 });
  log("configuration 1:", await text("#status"));
  await shot("right-angle");

  // Configuration 2: reset, then P high on the left with the angle hint on.
  await page.click("#resetBtn");
  await page.check('input[name="mode"][value="hint"]');
  await dragP({ x: 150, y: 64 });
  log("configuration 2:", await text("#status"));
  await shot("angle-hint");

  // Toggle the names box both ways and move P with the keyboard alone.
  await page.click("#names");
  await page.click("#names");
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await handlePos();
  await idle();
  log("keyboard moved P:", before.x !== after.x || before.y !== after.y);
  log("focus stays on P:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));

  if (!first) return;
  await page.check('input[name="mode"][value="plain"]');
  log("plain status:", await text("#status"));
};
