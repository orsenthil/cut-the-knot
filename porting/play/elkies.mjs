// Elkies: two configurations of the triangle and the cut, with the highlight changed.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs elkies
export default async ({ page, first, log, shot, text }) => {
  async function drag(index, dx, dy) {
    const handle = page.locator("#board .geom-handle").nth(index);
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle " + index + " is not on the board");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  await shot("start");
  log("start:", await text("#status"));

  // Configuration 1: a skewed triangle, P moved towards A2, pair 3 coloured.
  await drag(0, -26, 14);
  await drag(3, 34, -6);
  await page.check('input[name="pair"][value="3"]');
  log("after configuration 1:", await text("#status"));
  await shot("pair-3");

  if (!first) return; // the dark run only needs the first configuration's shot

  // Configuration 2: reset, move both base corners, and show all six circles.
  await page.click("#resetBtn");
  await drag(1, 30, -16);
  await drag(2, -26, 18);
  await page.check('input[name="pair"][value="6"]');
  log("after configuration 2:", await text("#status"));
  await shot("all-circles");
};
