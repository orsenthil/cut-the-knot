// Circles Cover Quadrilateral: two configurations of the illustration.
// There is no win or loss; the screenshots show the theorem's hypothesis and
// a reshaped quadrilateral. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs circles-cover-quadrilateral
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await corner(name).boundingBox();
    if (!board || !handle) throw new Error(`no handle for corner ${name}`);
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };
  const radius = async (name, value) => {
    const el = page.locator(`#radius${name}`);
    await el.evaluate((node, v) => {
      node.value = String(v);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: make the four circles cover the quadrilateral.
  await page.click("#fitBtn");
  log("covering:", await text("#status"));
  await shot("covering");

  // Second configuration: reshape the quadrilateral and change two radii.
  await drag("A", 0.18, 0.30);
  await drag("C", 0.82, 0.78);
  await radius("B", 205);
  await radius("D", 185);
  log("reshaped:", await text("#status"));
  await shot("reshaped");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: the moved corner must keep focus.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Every button in a player's order, in both directions.
  for (const name of ["A", "B", "C", "D"]) {
    await page.click(`#toggle${name}`);
    log(`after hiding ${name}:`, await text("#status"));
  }
  for (const name of ["A", "B", "C", "D"]) await page.click(`#toggle${name}`);
  log("all circles back on:", await text("#status"));

  // Sliders at both ends and a click inside a circle on the board.
  for (const name of ["A", "B", "C", "D"]) await radius(name, 0);
  log("all radii zero:", await text("#status"));
  await page.click("#fitBtn");
  for (const name of ["A", "B", "C", "D"]) await radius(name, 600);
  log("all radii maximum:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
