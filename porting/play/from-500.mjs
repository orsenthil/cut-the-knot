// From 500: show the parallel case, then a concurrent case with the hint on.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs from-500
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, target) => {
    const dot = await handle(name).boundingBox();
    if (!dot) throw new Error(`no handle for ${name}`);
    // Ask the SVG for the screen point of a board point, so the top-of-arc
    // target is exact even when the board is scaled down on a phone.
    const at = await page.evaluate(({ x, y }) => {
      const svg = document.getElementById("board");
      const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
      return { x: p.x, y: p.y };
    }, target);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x, at.y, { steps: 12 });
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  // Configuration 1: X at the top of the arc, so TX, YZ and AB are parallel.
  await drag("X", { x: 166.667, y: 240 });
  const parallel = await text("#status");
  log("X at the top:", parallel);
  if (!/parallel/i.test(parallel)) throw new Error("the parallel case was not reached");
  await shot("parallel");

  // Configuration 2: a big circle with X to the right, so the three lines
  // meet at a point on AB extended. Show the names and the equal-length marks.
  await page.click("#resetBtn");
  await page.click("#namesBox");
  await page.click("#hintBox");
  await drag("O", { x: 230, y: 280 });
  await drag("X", { x: 280, y: 193.4 });
  const concurrent = await text("#status");
  log("X to the right, with hint:", concurrent);
  if (!/meet at P/i.test(concurrent)) throw new Error("the concurrent case was not reached");
  await shot("concurrent");

  if (!first) return; // both screenshots have been taken in the dark run too

  // Arrow keys move a handle without losing keyboard focus.
  const x = handle("X");
  await x.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  if (!focused.startsWith("Point X")) throw new Error("keyboard focus left point X");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#hintBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
