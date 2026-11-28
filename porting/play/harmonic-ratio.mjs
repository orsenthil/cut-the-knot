// Harmonic Ratio: two configurations of the same construction; no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs harmonic-ratio
export default async ({ page, first, log, shot, idle, text }) => {
  const dot = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await dot(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move E and I far away from their starting spots.
  await drag("E", -34, -22);
  await drag("I", 16, 10);
  await page.click("#checkBtn");
  log("E and I moved:", await text("#status"));
  await shot("moved-E-I");

  // Second configuration: reset and change the base triangle by moving C and B.
  await page.click("#newBtn");
  await drag("C", -26, 6);
  await drag("B", 22, -20);
  await page.click("#namesBtn");
  log("new base C and B, names on:", await text("#status"));
  log("Show names pressed:", await page.getAttribute("#namesBtn", "aria-pressed"));
  await shot("new-base");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard motion keeps focus on the dot and updates the construction.
  await dot("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in the order a player would, in both directions.
  await page.click("#checkBtn");
  log("after Check the ratio:", await text("#status"));
  await page.click("#namesBtn");
  log("Show names pressed again:", await page.getAttribute("#namesBtn", "aria-pressed"));
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
