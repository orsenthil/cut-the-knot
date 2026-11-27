// Eight Point Circle: two configurations of the illustration, no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs eight-point-circle
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

  // First configuration: shift A and D; the opposite corners follow so the
  // diagonals stay perpendicular. Show the diagonals and all the labels.
  await drag("A", 55, 35);
  await drag("D", -45, -25);
  await page.click("#showDiagonals");
  await page.click("#showLabels");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move the other pair of corners and show the
  // two diameters and the rectangle that prove the claim.
  await page.click("#resetBtn");
  await drag("B", 40, 45);
  await drag("C", -35, -30);
  await page.click("#showHint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  for (const id of ["#showDiagonals", "#showLabels", "#showHint"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
