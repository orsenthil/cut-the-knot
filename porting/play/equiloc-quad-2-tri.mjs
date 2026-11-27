// EquilocQuad2Tri: two different dragging configurations of the illustration.
// There is no win or loss in the applet, so the scenario takes two screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equiloc-quad-2-tri
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: S round the circle, C towards S, midlines shown.
  await drag("S", 34, -27);
  await drag("C", -8, -20);
  await page.click("#construction");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, put S on the other arc, move D past A, hint.
  await page.click("#resetBtn");
  await drag("S", -64, 18);
  await drag("D", 12, -22);
  await page.click("#construction");
  await page.click("#hint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on S after the redraw.
  await handle("S").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#hint");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  await page.click("#construction");
  await page.click("#construction");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
