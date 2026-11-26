// BicentricQuadri2: two configurations of the draggable bicentric-quadrilateral
// construction. This is an illustration, so there is no win or loss to play.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bicentric-quadri-2
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
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

  // First configuration: drag two vertices and show the first claim's circle.
  await drag("Vertex A", -18, -12);
  await drag("Vertex D", 10, 14);
  await page.click("#incircle");
  await page.click("#names");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: make the diagonals perpendicular and turn on every
  // option, including the applet's extended perpendicular lines.
  await page.click("#makeBtn");
  await page.click("#diagonals");
  await page.click("#extend");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved vertex.
  await handle("Vertex C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#extend");
  await page.click("#extend");
  await page.click("#diagonals");
  await page.click("#diagonals");
  await page.click("#names");
  await page.click("#incircle");
  await page.click("#incircle");
  await page.click("#makeBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
