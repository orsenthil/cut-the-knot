// This is an illustration, so there is no win or loss: the scenario shows two
// configurations of the same crossed-circle construction. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs equal-angles-in-crossed-circles
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy, steps = 10) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: the two marked angle pairs, with the points named.
  await page.click("#statementBtn");
  await drag("RS", 14, -8);
  await drag("RB", -8, 10);
  log("with the marked angles:", await text("#status"));
  await shot("angles");

  // Second configuration: a fresh start, dashed cross-chords and names hidden.
  await page.click("#newBtn");
  await page.click("#namesBtn");
  await page.click("#extraBtn");
  await drag("S", -12, -10);
  await drag("T", 12, -8);
  await drag("RS", 18, 12);
  log("second shape:", await text("#status"));
  await shot("second-shape");

  if (!first) return; // the dark run only needs the three screenshots

  // Keyboard alone: arrows move a handle and focus stays with it.
  await handle("RS").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrows:", focused.slice(0, 60));
  log("after keyboard:", await text("#status"));

  // Every button, each in both directions, then the reset.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#statementBtn");
  await page.click("#extraBtn");
  await page.click("#extraBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
