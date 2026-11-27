// Four Touching Circles III: an illustration, not a game. Show the opening
// ring of four outside touches, then slide the fourth circle inside the third
// so exactly one touch becomes an inside touch (three outside touches, odd),
// with the inverted picture on. Then exercise every checkbox, Reset and two
// keyboard-only handle moves.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-touching-circles-3
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePoint = (index) => page.evaluate((i) => {
    const h = document.querySelectorAll("#board .geom-handle")[i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const toClient = (p) => page.evaluate(([x, y]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }, [p.x, p.y]);

  const drag = async (index, to) => {
    const from = await handlePoint(index);
    const a = await toClient(from);
    const b = await toClient(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 18 });
    await page.mouse.up();
    await idle();
  };

  // Move a centre and its rim point by the same amount: the Java applet keeps
  // an absolute rim point, so the radius changes if only the centre is moved.
  const dragCircle = async (i, target) => {
    const centre = await handlePoint(i * 2);
    const rim = await handlePoint(i * 2 + 1);
    const d = { x: target.x - centre.x, y: target.y - centre.y };
    await drag(i * 2, target);
    await drag(i * 2 + 1, { x: rim.x + d.x, y: rim.y + d.y });
  };

  await shot("start");
  log("configuration 1 (four outside touches):", await text("#status"));

  if (!first) return;

  // Configuration 2: circle 4 moves inside circle 3. Its centre stays 105
  // units from circle 1 and 25 units from circle 3, so only the 2-3 touch
  // becomes internal and the outside count drops to three.
  await dragCircle(3, { x: 252.2727, y: 183.7758 });
  await page.check("#inversionChk");
  await page.check("#pointsChk");
  await page.check("#centersChk");
  log("configuration 2 (one inside touch, inversion on):", await text("#status"));
  await shot("configuration-2-odd-inversion");

  // Every option in both directions, and the reset button.
  await page.uncheck("#circlesChk");
  await page.check("#circlesChk");
  await page.uncheck("#pointsChk");
  await page.check("#pointsChk");
  await page.uncheck("#centersChk");
  await page.check("#centersChk");
  await page.uncheck("#inversionChk");
  log("inversion off again:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // Two keyboard-only moves; focus and the status must survive each redraw.
  await page.locator("#board .geom-handle").nth(6).focus();
  const before = await handlePoint(6);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await handlePoint(6);
  await idle();
  log("keyboard moved circle 4's centre:", before.x !== after.x || before.y !== after.y);
  log("focus stays on the board handle:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("after keyboard:", await text("#status"));
  log("no win or loss: this is an illustration");
};
