// BOL1: turn the two parallel diameters, then pull a centre off the line of
// tangency so the circles cross. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-1
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

  // First configuration: turn C around its circle; the other diameter follows.
  await drag("Point C", 70, -55);
  log("after turning C:", await text("#status"));
  await shot("turned");

  if (first) {
    // Keyboard movement on a handle keeps focus on that same handle.
    await handle("Point C").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
  }

  // Second configuration: O2 leaves the line through A and O1, so the two
  // circles cross instead of touching and the proposition no longer applies.
  await page.click("#newBtn");
  await drag("Centre O2", 95, 25);
  await page.click("#checkBtn");
  log("after pulling O2 off the line and checking:", await text("#status"));
  await shot("off-line");

  if (!first) return; // the dark run only needs the two screenshots above

  // Press every button in a player's order, and reset to a tangent picture.
  await page.click("#hintBtn");
  log("with the proof hint:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#newBtn");
  await page.click("#checkBtn");
  log("after Reset and Check on the starting picture:", await text("#status"));
};
