// Angle Bisector Ratio 2: drag the triangle to two configurations and look at
// the ratio line and the extra construction.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-bisector-ratio-2
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

  // First configuration: pull A toward the middle, making a narrow triangle.
  await drag("A", 58, -48);
  log("after dragging A:", await text("#status"));
  await shot("narrow");

  // Second configuration: reset, move C down-left, then show both overlays.
  await page.click("#newBtn");
  await drag("C", -78, 72);
  await page.click("#hintBtn");
  await page.click("#extraBtn");
  await page.click("#checkBtn");
  log("after dragging C and showing the proof:", await text("#status"));
  await shot("proof");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps the focus on the same handle after a redraw.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in a player's order, and toggle both ways.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#extraBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
