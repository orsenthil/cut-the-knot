// Minkowski Addition: two configurations of the four draggable points.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs minkowski-addition
export default async ({ page, first, log, shot, idle, text }) => {
  const labels = { A: "Point A", B: "Point B", O: "Point O.", Op: "Point O'" };
  const handle = (name) => page.locator(`#board [aria-label^="${labels[name]}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull A and the first origin into new places, and
  // hide the second sum so the first parallelogram stands on its own.
  await drag("A", 32, -26);
  await drag("O", -22, -18);
  await page.uncheck("#showSecond");
  log("first configuration:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move B and the second origin the other way,
  // then show all three sets of lines again.
  await page.click("#resetBtn");
  await drag("B", -34, 22);
  await drag("Op", -26, -20);
  await page.check("#showSecond");
  log("second configuration:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.uncheck("#showFirst");
  await page.uncheck("#showShift");
  await page.check("#showFirst");
  await page.check("#showShift");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
