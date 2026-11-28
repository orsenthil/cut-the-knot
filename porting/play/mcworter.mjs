// McWorter: two configurations of the squares and the triangle at D.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs mcworter
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: carry C down and right; the squares change and D
  // moves to the other side of the triangle, still inside the board.
  await drag("C", 60, 40);
  log("C down and right:", await text("#status"));
  await shot("far-right");

  // Second configuration: reset and move the base points as well, then show
  // all three applet overlays and check McWorter's claim.
  await page.click("#newBtn");
  await drag("C", 55, 40);
  await drag("A", 20, -10);
  await drag("B", -20, -10);
  await page.click("#namesBtn");
  await page.click("#linesBtn");
  await page.click("#hintBtn");
  log("shifted base with overlays:", await text("#status"));
  await shot("shifted-base");
  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await shot("checked");

  if (!first) return; // the dark run only needs the three screenshots

  // Keyboard movement keeps focus on the handle after the redraw.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in both directions, as a player would.
  await page.click("#hintBtn");
  await page.click("#linesBtn");
  await page.click("#namesBtn");
  log("after hiding everything:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#linesBtn");
  await page.click("#hintBtn");
  log("after showing everything again:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));

  // Keyboard shortcuts for the same controls.
  await page.keyboard.press("KeyR");
  await page.keyboard.press("KeyN");
  await page.keyboard.press("KeyL");
  await page.keyboard.press("KeyH");
  await page.keyboard.press("KeyC");
  log("after keyboard shortcuts:", await text("#status"));
};
