// Cardi: show the tangent/mirror construction at one angle, then reset and show
// the hinged parallelogram at another. The light run also exercises the
// buttons and the keyboard, and checks that focus stays on the board.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cardi
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
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
  log("initial:", await text("#status"));
  await shot("initial");

  // Configuration 1: M dragged to a new place, with the tangent and mirror.
  await page.click("#showBtn");
  await drag("M", -53, 46);
  log("tangent configuration:", await text("#status"));
  await shot("tangent");

  // Configuration 2: reset, the hinged parallelogram, and T dragged round O.
  await page.click("#resetBtn");
  await page.click('[data-mode="parallelogram"]');
  await drag("T", -70, 22);
  log("parallelogram configuration:", await text("#status"));
  await shot("parallelogram");

  if (!first) return; // the dark run only needs the screenshots above

  // The keyboard alone moves a handle; focus must survive the redraw.
  await handle("M").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await shot("keyboard");

  // Press each button in the order a player would, and every mode.
  await page.click("#playBtn");
  await page.waitForTimeout(350);
  await page.click("#playBtn");
  log("after play/pause:", await text("#status"), "| button =", await text("#playBtn"));
  await page.click("#stepBtn");
  await page.click("#showBtn");
  log("construction hidden:", await text("#showBtn"));
  await page.click("#showBtn");
  await page.click('[data-mode="cross"]');
  await page.click('[data-mode="double"]');
  log("chords overlay:", await text("#status"));
  await shot("chords");
  await page.click('[data-mode="parallelogram"]');
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
