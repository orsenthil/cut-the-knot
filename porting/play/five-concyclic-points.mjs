// Five Concyclic Points: an illustration, not a game. Show two different
// configurations, then press every button, toggle the names box both ways and
// move a handle with the keyboard alone.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs five-concyclic-points
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePos = (index) => page.evaluate((i) => {
    const h = document.querySelectorAll("#board .geom-handle")[i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (index, x, y) => {
    const from = await handlePos(index);
    const a = await client(from.x, from.y);
    const b = await client(x, y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");
  log("start:", await text("#status"));

  // Configuration 1: change the two secant directions by dragging their
  // handles; the green circle should still gather all five marked points.
  await drag(4, 455, 44); // Lm
  await drag(5, 290, 52); // Ln
  log("configuration 1:", await text("#status"));
  await shot("config-1");

  // Configuration 2: the applet's alternative arrangement button.
  await page.click("#exampleBtn");
  log("configuration 2:", await text("#status"));
  await shot("config-2");

  // Every button and option, both directions.
  await page.click("#namesChk");
  await page.click("#namesChk");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  if (!first) return;

  // Two keyboard-only moves; focus must stay on the handle after each one.
  const before = await handlePos(0);
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await handlePos(0);
  await idle();
  log("keyboard moved M:", before.x !== after.x || before.y !== after.y);
  log("focus stays on M:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("after keyboard:", await text("#status"));
  await shot("keyboard");

  await shot("final");
};
