// EquilocQuad1Tri: two configurations of the illustration. The applet has no
// win or loss, so the scenario takes two screenshots of different diagrams.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equiloc-quad-1-tri
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: slide S along the arc, bring C towards S, and mark
  // the equal angles and sides. Q should still sit at the arc's midpoint.
  await drag("S", -24, 26);
  await drag("C", -10, -12);
  await page.click("#construction");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, put S on the other side of AB, slide D and
  // show the two proof triangles. The status reports the wrong apex.
  await page.click("#resetBtn");
  await drag("S", -38, 112);
  await drag("D", 14, -20);
  await page.click("#construction");
  await page.click("#hint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on S after each redraw.
  await handle("S").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  for (const id of ["#hint", "#names", "#construction"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
