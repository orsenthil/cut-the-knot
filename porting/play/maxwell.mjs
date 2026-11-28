// Maxwell: reshape the two triangles in two configurations and look at the diagram.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs maxwell
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const h = handle(name);
    const box = await h.boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration, Parallel: pull a base vertex and slide P. The purple
  // triangle changes shape and the green triangle is rebuilt from its cevians.
  await drag("A of triangle ABC", 70, -28);
  await drag("P of triangle ABC", 24, 22);
  log("parallel configuration:", await text("#status"));
  await shot("parallel");

  // Second configuration, Perpendicular: a different mode and a moved P'.
  await page.click("#perpendicularRadio");
  await drag("P' of triangle", 42, 28);
  await drag("B of triangle ABC", -38, 26);
  log("perpendicular configuration:", await text("#status"));
  await shot("perpendicular");

  if (!first) return; // the dark run only needs the two screenshots above

  // Both options in both directions; the status must name the chosen mode.
  await page.click("#parallelRadio");
  log("back to parallel:", await text("#status"));
  await shot("parallel-again");
  await page.click("#perpendicularRadio");
  log("perpendicular again:", await text("#status"));

  // Keyboard only: focus must stay on the prime vertex after the recomputation.
  await handle("A' of triangle").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
