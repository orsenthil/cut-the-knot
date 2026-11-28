// Hinged Napoleon: two configurations of the same illustration.
// It has no win or loss, so the scenario shows the B, C hinges fully closed at
// 120°, then a different swivel halfway through its turn.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-napoleon
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);

  /** Drag a corner to a point given in SVG viewBox units. */
  async function drag(name, at) {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const to = await page.evaluate((p) => {
      const svg = document.getElementById("board");
      const q = svg.createSVGPoint();
      q.x = p.x; q.y = p.y;
      const s = q.matrixTransform(svg.getScreenCTM());
      return { x: s.x, y: s.y };
    }, at);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }

  const setRange = (id, value) => page.locator(`#${id}`).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: the applet's default B, C choice at the scrollbar's
  // maximum. Both green corners should land on A and the two pieces close.
  await setRange("turn", 120);
  await drag("A", { x: 300, y: 105 });
  await page.click("#names");
  log("first (B, C at 120°):", await text("#status"));
  await shot("hinged-120");

  // Keyboard alone: two arrow moves; focus must stay on the moved corner.
  await corner("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focused);
  if (!/Corner B/.test(focused || "")) throw new Error("focus left corner B after arrow keys");

  // Configuration 2: reset, turn halfway, choose the other pair, drag C.
  await page.click("#resetBtn");
  await setRange("turn", 60);
  await page.click("#swivelAB");
  await drag("C", { x: 235, y: 220 });
  log("second (A, B at 60°):", await text("#status"));
  await shot("hinged-60");

  if (!first) return; // the dark run only needs the two screenshots

  // Every control, in both directions, in a player's order.
  for (const value of [0, 120, 60]) await setRange("turn", value);
  for (const id of ["swivelBC", "swivelAC", "swivelAB"]) await page.click(`#${id}`);
  const pressed = await page.evaluate(() =>
    [...document.querySelectorAll(".swivels button")].map((b) => b.getAttribute("aria-pressed")).join(","));
  log("swivel buttons after clicking each:", pressed);
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
