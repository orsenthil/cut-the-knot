// Archimedes Quadruplets: a drawing, not a game. Drag C to two very different
// arbeloses and watch the four Power circles keep the twins' radius and area.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs archimedes-quadruplets
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePos = (index) => page.evaluate((i) => {
    const h = document.querySelectorAll("#board .geom-handle")[i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const toClient = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (index, toX) => {
    const from = await handlePos(index);
    const a = await toClient(from.x, from.y);
    const b = await toClient(toX, from.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");
  log("at the start:", await text("#status"));

  // Configuration 1: C near A, so the left small semicircle is tiny.
  await drag(1, 90);
  log("configuration 1:", await text("#status"));
  await shot("c-near-a");

  // Configuration 2: C near B, the mirror picture. Drag A and B as well.
  await drag(1, 300);
  await drag(0, 45);
  await drag(2, 325);
  log("configuration 2:", await text("#status"));
  await shot("c-near-b");

  // Every button and option, both directions.
  await page.click("#midBtn");
  log("C in the middle:", await text("#status"));
  await shot("middle");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.uncheck("#twinsChk");
  await page.check("#twinsChk");
  await page.uncheck("#linesChk");
  await page.check("#linesChk");
  await page.check("#labelsChk");
  log("labels shown:", await page.evaluate(
    () => document.querySelector("#board .geom-layer-labels").style.display !== "none"));
  await page.uncheck("#labelsChk");

  // Two keyboard-only moves; focus must stay on the board after each redraw.
  const before = await handlePos(1);
  await page.locator("#board .geom-handle").nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos(1);
  await idle();
  log("keyboard moved C:", before.x !== after.x || before.y !== after.y);
  log("focus stays on C:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("keyboard radius:", await text("#status"));

  if (!first) return;
  await page.click("#midBtn");
  log("final middle:", await text("#status"));
};
