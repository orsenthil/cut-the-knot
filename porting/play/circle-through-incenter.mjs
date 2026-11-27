// CircleThroughIncenter: two configurations of the illustration, with the clue boxes on.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-through-incenter
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
  log("starting picture:", await text("#status"));
  await shot("start");

  // First configuration: a compact triangle with all four clues on.
  await page.click("#showPremises");
  await page.click("#showHint");
  await drag("A", 64, 38);
  await drag("B", -18, 36);
  log("compact triangle:", await text("#status"));
  await shot("compact");

  if (!first) return; // the dark run only needs the screenshots above

  // Keyboard-only moves keep focus on the board; then check every control.
  await corner("C").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);

  await page.click("#newBtn");
  await drag("C", -96, 40);
  await drag("A", 36, 70);
  log("second configuration:", await text("#status"));
  await shot("second");

  await page.click("#showStatement");
  await page.click("#showStatement");
  await page.click("#showPremises");
  await page.click("#showHint");
  await page.click("#showNames");
  await page.click("#showNames");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
