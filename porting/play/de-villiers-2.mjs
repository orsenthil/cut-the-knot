// deVilliers2: two configurations of the illustration, one for each picture.
// There is no win or loss: the tangents and the perpendicular bisectors are
// always drawn, and the boxes only choose what extra marks to show.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs de-villiers-2
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  log("show boxes disabled before a picture is chosen:",
    await page.evaluate(() => document.getElementById("names").disabled));

  // First configuration: the primary (tangent) picture with names and the
  // original diagonals. Pull B most of the way around the circle.
  await page.click("#primary");
  await page.click("#names");
  await drag("B", 58, -42);
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: the secondary (bisector) picture with its angle
  // bisectors, diagonals and incircle. Move D away from its start.
  await page.click("#primary"); // same two choices cannot both be on
  await page.click("#secondary");
  await page.click("#diagonals");
  await page.click("#angles");
  await drag("D", -44, 38);
  log("second shape:", await text("#status"));
  log("tangency joints:", await page.evaluate(() =>
    document.querySelectorAll("#board .incircle:not([style*='none'])").length));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner, and the
  // corner must stay on the circle after the redraw.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#angles");
  await page.click("#angles");
  await page.click("#diagonals");
  await page.click("#diagonals");
  await page.click("#joints");
  await page.click("#joints");
  await page.click("#names");
  await page.click("#names");
  await page.click("#secondary");
  await page.click("#primary");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
