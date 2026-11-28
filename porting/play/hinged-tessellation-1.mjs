// Hinged Tessellation A: two configurations of the same illustration.
// It has no win or loss, so the scenario shows the starting (4,3,3,4,3)
// square-and-triangle tiling, then the 60-degree six-triangle tiling.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-tessellation-1
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);

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
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  }

  const setRange = (id, value) => page.locator(`#${id}`).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("square");

  // A at +75 degrees from B: the angle ABC is 60 and the rhombi split into
  // two equilateral triangles each.
  await drag("A", { x: 365.0788, y: 275.0788 });
  log("at 60 degrees:", await text("#status"));
  await shot("six-triangles");

  // Keyboard alone: two arrow moves, and focus must stay on the handle.
  await corner("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focused);
  if (!/Point B/.test(focused || "")) throw new Error("focus left corner B after arrow keys");

  if (!first) return; // the dark run only needs the two screenshots

  // Every control, in a player's order and in both directions.
  for (const value of [0, 15, 7, 4]) await setRange("layers", value);
  for (const id of ["modeOne", "modeTwo", "modeBands", "modeOne", "modeBands"]) await page.click(`#${id}`);
  await setRange("layers", 15);
  log("largest picture:", await text("#status"));
  await shot("bands-max");
  await setRange("layers", 0);
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
