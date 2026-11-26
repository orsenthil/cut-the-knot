// ButterflyInEllipse: reshape the crossed quadrilateral twice.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs butterfly-in-ellipse
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const h = handle(label);
    const box = await h.boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move a vertex along the oval and one crossing on
  // the line, then name everything and check that all crossings stayed put.
  await drag("Vertex A", 14, -26);
  await drag("Crossing F ab", 12, 5);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: a new picture, a different vertex, a moved line end
  // and eight sides instead of four; names go away with N != 4.
  await page.click("#resetBtn");
  await drag("Vertex C", -22, 14);
  await drag("End of the straight line", -12, -10);
  await page.click("#nPlus");
  await page.click("#nPlus");
  await page.click("#nPlus");
  await page.click("#nPlus");
  await page.click("#checkBtn");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await handle("Vertex B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#nMinus");
  await page.click("#nMinus");
  await page.click("#nMinus");
  await page.click("#nMinus");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
