// Arbelos PWW: a drawing, not a game. Drag N to two very different arbeloses,
// reading the equal areas off the status line, then move it with the keyboard.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs arbelos-pww
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragN = async (toX) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(toX, from.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");

  // Configuration 1: N to the right, so the blue part is the larger one.
  await dragN(300);
  log("configuration 1:", await text("#status"));
  await shot("blue-larger");

  // Configuration 2: N near A, so the red part is much larger.
  await dragN(110);
  log("configuration 2:", await text("#status"));
  await shot("red-larger");

  // Every button, both ways round.
  await page.click("#middleBtn");
  log("N in the middle:", await text("#status"));
  await shot("middle");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // Keyboard alone: two arrow moves, and focus stays on the handle.
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos();
  await idle();
  log("keyboard moved N:", before.x !== after.x || before.y !== after.y);
  log("focus stays on N:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));

  if (!first) return;
  await dragN(250);
  log("after a final drag:", await text("#status"));
};
