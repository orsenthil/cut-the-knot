// Midpoints: place three dots and close the chain, then four dots that cannot
// close it. This is a demo, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs midpoints
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = page.locator('#board [aria-label^="Cursor"]');
  /* Use the SVG's own matrix, not a bounding-box estimate: the applet snapped
     pointer positions to a 2-unit grid, so a 1-pixel error changes a dot. */
  const clientFor = (x, y) => page.evaluate(({ x, y }) => {
    const svg = document.getElementById("board");
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, { x, y });
  const clickBoard = async (x, y) => {
    const p = await clientFor(x, y);
    await page.mouse.click(p.x, p.y);
  };
  const dragCursor = async (x, y) => {
    const box = await handle.boundingBox();
    if (!box) throw new Error("no cursor handle on the board");
    const to = await clientFor(x, y);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.mouse.up();
  };
  const target = () => page.evaluate(() => {
    const dot = document.querySelector("#board .target-dot");
    return { x: Number(dot.getAttribute("cx")), y: Number(dot.getAttribute("cy")) };
  });

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: three midpoints. The red rings sit at their fixed
  // alternating sum, the only starting vertex that closes the polygon.
  for (const [x, y] of [[100, 100], [200, 100], [150, 200]]) await clickBoard(x, y);
  log("three dots placed:", await text("#status"));
  await page.click("#dragBtn");
  log("in drag mode:", await text("#status"));
  const oddTarget = await target();
  await dragCursor(oddTarget.x, oddTarget.y);
  const oddStatus = await text("#status");
  log("odd, cursor on target:", oddStatus);
  if (!/chain closes/.test(oddStatus)) throw new Error("the odd chain did not close: " + oddStatus);
  await shot("odd-closed");

  // Second configuration: four dots that do not form a parallelogram, so the
  // chain ends a fixed distance from the cursor wherever it is moved.
  await page.click("#resetBtn");
  for (const [x, y] of [[100, 80], [240, 80], [240, 220], [120, 250]]) await clickBoard(x, y);
  await page.click("#dragBtn");
  await dragCursor(200, 180);
  const evenStatus = await text("#status");
  log("even, no solution:", evenStatus);
  if (!/never closes/.test(evenStatus)) throw new Error("the even chain should not close: " + evenStatus);
  await shot("even-no-solution");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the cursor after each redraw.
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in the order a player would, in both directions.
  await page.click("#placeBtn");
  log("back to Place points:", await text("#status"));
  await page.click("#addBtn");
  log("after Place midpoint at cursor:", await text("#status"));
  await page.click("#dragBtn");
  await page.click("#dragBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
