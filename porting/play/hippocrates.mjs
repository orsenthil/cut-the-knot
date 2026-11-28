// Hippocrates: first match the dots with the keyboard, then move C and match
// again by dragging E. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hippocrates
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handle = (index) => page.evaluate((i) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const drag = async (index, from, to) => {
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // The E handle is the third one. Two arrow-key presses take it from x=333
  // to x=327, close enough for the applet's "under one unit" match test.
  await page.locator("#board .geom-handle").nth(2).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  log("after two keyboard moves:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await page.click("#namesBox");
  await page.click("#hintBox");
  log("with names and hint:", await text("#status"));
  await shot("matched");

  if (!first) return; // the dark run only needs the first configuration's shot

  // Second configuration: move C, which also carries E and the circle up,
  // then compute where E has to be and drag it there.
  await page.click("#newBtn");
  const c0 = await handle(1);
  await drag(1, c0, { x: 80, y: 140 });
  const e0 = await handle(2);
  const targetX = await page.evaluate(() => {
    const Core = new Function("return HippocratesCore")();
    const hs = [...document.querySelectorAll("#board .geom-handle")];
    const at = (i) => ({ x: Number(hs[i].getAttribute("cx")), y: Number(hs[i].getAttribute("cy")) });
    const A = at(0), C = at(1), E = at(2);
    const state = { A, B: { x: 333, y: A.y }, C, E, radius: 2 * Core.dist(A, C) };
    return Core.solveE(state);
  });
  log("C moved; E target:", targetX.toFixed(2), "from", e0.x.toFixed(2));
  await drag(2, e0, { x: targetX, y: e0.y });
  log("after dragging E:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("moved-c");

  // The focus must stay on the handle after keyboard moves, and every control
  // must answer: reset puts the picture back, the hint is disabled again.
  await page.locator("#board .geom-handle").nth(1).focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  log("focus after keyboard:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  await page.click("#newBtn");
  log("after reset:", await text("#status"), "| hint disabled:", await page.isDisabled("#hintBox"));
};
