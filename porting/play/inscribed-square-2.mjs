// Inscribed Square 2: drag the triangle into two configurations and look at
// the square the Vecten construction cuts from it. There is no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inscribed-square-2
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
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
  await shot("start");

  // First configuration: keep C above AB with its foot over the base, so the
  // red square has all four corners on the triangle's sides.
  await drag("A", -30, 8);
  await drag("C", -18, -14);
  log("first configuration:", await text("#status"));
  await shot("inside");

  // Second configuration: pull C below AB, where the same construction puts
  // the red square outside the triangle. The status line says so in words.
  await drag("C", 22, 90);
  log("second configuration:", await text("#status"));
  await shot("outside");

  if (!first) return; // the dark run only needs the two configuration shots

  // Both checkboxes in both directions, then a keyboard-only move.
  for (const id of ["namesBox", "hintBox"]) {
    await page.check(`#${id}`);
    log(`${id} on:`, (await text("#status")).slice(0, 60));
  }
  await shot("options-on");
  for (const id of ["namesBox", "hintBox"]) await page.uncheck(`#${id}`);
  log("options off:", (await text("#status")).slice(0, 60));
  await shot("options-off");

  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
