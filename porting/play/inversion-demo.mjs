// Inversion Demo: an illustration, so the two configurations stand in for a
// win and a loss. Add two circles, then drag the first one until it passes
// through O: its dashed image must straighten into a line. A keyboard nudge
// keeps focus on the moved dot, and the three buttons are all pressed in turn.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inversion-demo

export default async ({ page, first, log, shot, text }) => {
  const board = async () => page.locator("#board").boundingBox();
  const localToClient = (box, p) => ({
    x: box.x + (p.x / 600) * box.width,
    y: box.y + (p.y / 450) * box.height,
  });
  const drag = async (from, to) => {
    const box = await board();
    const a = localToClient(box, from);
    const b = localToClient(box, to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: two random circles, each with a dashed image circle.
  await page.click("#addBtn");
  await page.click("#addBtn");
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: translate circle 1 so its centre is exactly one radius
  // from O. Its image must now be a straight line.
  const pts = await page.evaluate(() => {
    const at = (sel) => {
      const el = document.querySelector(sel);
      return { x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")) };
    };
    return {
      O: at('[aria-label^="Point O,"]'),
      C: at('[aria-label^="Centre of circle 1."]'),
      B: at('[aria-label^="Rim point of circle 1."]'),
    };
  });
  const v = { x: pts.B.x - pts.C.x, y: pts.B.y - pts.C.y };
  const targetC = { x: pts.O.x + v.x, y: pts.O.y + v.y };
  const rim = { x: pts.C.x - v.x, y: pts.C.y - v.y }; // opposite B, so no handle is hit
  const shift = { x: targetC.x - pts.C.x, y: targetC.y - pts.C.y };
  await drag(rim, { x: rim.x + shift.x, y: rim.y + shift.y });
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    // Two arrow-key moves on a rim dot; the dot must keep keyboard focus.
    await page.locator('[aria-label^="Rim point of circle 1."]').focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focus after two arrow keys:", focused);
    await shot("keyboard");
  }

  // Press each button in the order a player would, in both directions.
  await page.click("#removeBtn");
  log("after Remove:", await text("#status"));
  await page.click("#removeBtn"); // empty stack: nothing changes
  log("after Remove on empty:", await text("#status"));
  await page.click("#addBtn");
  log("after Add:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("buttons");

  await shot("final");
};
