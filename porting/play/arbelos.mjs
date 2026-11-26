// Arbelos: a drawing, not a game. Drag the dividing point N to two different
// configurations and read the matching areas off the status line.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs arbelos
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

  // Configuration 1: N right of centre, so AN is the larger part.
  await dragN(232);
  log("configuration 1:", await text("#status"));
  await shot("wide-gap");

  // Configuration 2: N near A, so the circle on PN is much smaller.
  await dragN(70);
  log("configuration 2:", await text("#status"));
  await shot("narrow-gap");

  // Press every button and take every option both ways.
  await page.click("#middleBtn");
  log("after N in the middle:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.uncheck("#circleChk");
  await page.check("#circleChk");
  await page.check("#chordChk");
  await page.uncheck("#chordChk");

  // Two keyboard-only moves, checking that focus stays on the handle.
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
  await dragN(160);
  log("after a final drag:", await text("#status"));
};
