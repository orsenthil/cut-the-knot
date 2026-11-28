// Incircles In Quadri: two configurations of an illustration (no win or loss).
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs incircles-in-quadri
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
  if (/^The two circles on AC touch\./.test(await text("#status"))) throw new Error("start shape unexpectedly touches");

  // First configuration: a skewed quadrilateral, viewed along the BD pair.
  await drag("A", 34, 20);
  await drag("C", -26, -30);
  await page.click("#bdBtn");
  log("first shape, pair on BD:", await text("#status"));
  await shot("first");

  // Second configuration: all four sides fit one circle, viewed along AC.
  await page.click("#tangentialBtn");
  await page.click("#acBtn");
  const second = await text("#status");
  log("second shape, pair on AC:", second);
  if (!/The two circles on AC touch\./.test(second)) throw new Error("tangential shape did not touch");
  if (!/pair on BD touches too\./.test(second)) throw new Error("other pair did not touch");
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must remain on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  if (!/Corner C/.test(focused)) throw new Error("keyboard focus left corner C");
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#acBtn");
  await page.click("#bdBtn");
  await page.click("#tangentialBtn");
  await page.click("#tangentialBtn");
  await page.click("#resetBtn");
  await page.click("#acBtn");
  log("after Reset and pair switches:", await text("#status"));
};
