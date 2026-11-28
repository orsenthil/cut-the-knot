// Max Common Chord 3: drag the chord into one position, then construct the
// maximizing chord after moving Q. Both configurations are screenshotted.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs max-common-chord-3
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
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
  log("opening:", await text("#status"));

  // First configuration: slide A along its circle and turn on the labels.
  await drag("A", 18, -46);
  await page.click("#namesBtn");
  log("after dragging A:", await text("#status"));
  await shot("chord");

  // Second configuration: move Q to reshape the circles, then construct the
  // chord whose centre S bisects arc TU.
  await page.click("#newBtn");
  await drag("Q", -26, -34);
  await page.click("#bestBtn");
  log("after Show best chord:", await text("#status"));
  await shot("best");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard-only movement keeps focus on the handle after the redraw.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:", await page.evaluate(() => {
    const el = document.activeElement;
    return el && el.getAttribute("aria-label");
  }));
  log("status after keyboard:", await text("#status"));

  // Press every button in player order, and change each option both ways.
  await page.click("#circlesBtn");
  await drag("A", -14, 22);
  log("circles mode:", await text("#status"));
  await page.click("#chordBtn");
  await drag("B", 12, -18);
  log("chord mode:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#bestBtn");
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
