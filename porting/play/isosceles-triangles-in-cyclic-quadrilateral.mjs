// Parallel Lines in a Cyclic Quadrilateral: two configurations of the four
// points on the circle.  This is a droodle, so there is no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs isosceles-triangles-in-cyclic-quadrilateral
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull C and D around the circle, show the tick marks.
  await drag("C", 42, -58);
  await drag("D", -36, -24);
  await page.click("#show-premise");
  log("first crossing configuration:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move A and B, show the statement and hint.
  await page.click("#resetBtn");
  await drag("A", -54, 26);
  await drag("B", 46, -32);
  await page.click("#show-statement");
  await page.click("#show-hint");
  await page.click("#show-names");
  log("second crossing configuration:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions, including a
  // non-crossing order where MN is no longer parallel to AB.
  await page.click("#show-premise");
  await page.click("#show-premise");
  await page.click("#show-statement");
  await page.click("#show-hint");
  await page.click("#show-names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
