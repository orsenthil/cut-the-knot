// Arbelos Concyclic: an illustration, not a game. Drag C to two different
// configurations and read the two circle radii off the status line, then try
// every button, both tick boxes and the arrow keys.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs arbelos-concyclic
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragC = async (toX) => {
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
  log("start:", await text("#status"));

  // Configuration 1: C close to A, so the circle about M is small and the
  // one about N is large.
  await dragC(115);
  log("C near A:", await text("#status"));
  await shot("c-near-a");

  // Configuration 2: C close to B, with the remark's third circle shown.
  await page.click("#extraChk");
  await dragC(320);
  log("C near B with the third circle:", await text("#status"));
  await shot("c-near-b-third-circle");

  // Every button and option, both ways.
  await page.click("#middleBtn");
  log("C in the middle:", await text("#status"));
  await page.click("#namesChk");
  await page.click("#namesChk");
  await page.click("#extraChk");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  if (!first) return;

  // Two keyboard-only moves; focus must stay on the handle after each one.
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos();
  await idle();
  log("keyboard moved C:", before.x !== after.x || before.y !== after.y);
  log("focus stays on C:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("after keyboard:", await text("#status"));
  await shot("keyboard");

  await shot("final");
};
