// Hatzipolakis Triangle: two triangle shapes, with every button pressed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hatzipolakis-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name},"]`);
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

  // First configuration: a tall triangle with the three claimed lines shown.
  await drag("C", -42, -26);
  await drag("B", 24, -14);
  await page.click("#claimBtn");
  await page.click("#checkBtn");
  log("after Check the claims on the tall triangle:", await text("#status"));
  await shot("claim");

  // Second configuration: reset, then a flat triangle with the proof marks.
  await page.click("#newBtn");
  await drag("A", -58, 32);
  await drag("C", 26, -18);
  await page.click("#claimBtn");
  await page.click("#hintBtn");
  await page.click("#premiseBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("after the proof marks on the flat triangle:", await text("#status"));
  await shot("hint");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard: arrow keys move the focused vertex, and focus stays on it.
  await handle("B").focus();
  const before = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const after = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  log("focus before and after two arrow keys:", before, "->", after);
  log("status after keyboard moves:", await text("#status"));

  // Press every button once more in the other direction.
  await page.click("#hintBtn");
  await page.click("#premiseBtn");
  await page.click("#namesBtn");
  await page.click("#claimBtn");
  log("after hiding every overlay:", await text("#status"));
  await page.click("#checkBtn");
  await shot("checked-again");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
