// Connes: two configurations of the illustration — an exact equilateral
// triangle with the vector-sum parallelogram, and a scalene triangle after a
// drag — with the status read aloud at each step.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs connes
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the page's criterion holds and the parallelogram
  // carrying B1 + C1 is visible.
  await page.click("#newBtn");
  await page.click("#vectorsBtn");
  log("equilateral:", await text("#status"));
  await shot("equilateral-with-sums");

  // Two keyboard-only moves; the focus must survive the redraw.
  await corner("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("after keyboard:", await text("#status"));

  // Second configuration: back to the applet's starting triangle, then drag
  // C so the red sum dot moves away from O. Hide the parallelogram again.
  await page.click("#resetBtn");
  await drag("C", 95, 42);
  await page.click("#vectorsBtn");
  log("scalene:", await text("#status"));
  await shot("scalene");

  if (!first) return; // the dark run only needs the two screenshots above

  // Press every button in player order and change each option both ways.
  await page.click("#vectorsBtn");
  await page.click("#vectorsBtn");
  await page.click("#newBtn");
  log("after Make equilateral:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset triangle:", await text("#status"));
};
