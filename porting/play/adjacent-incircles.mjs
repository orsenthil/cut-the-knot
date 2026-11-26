// Adjacent Incircles: drag to an equal configuration and then disturb it.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs adjacent-incircles
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
  await page.click("#equalBtn");
  log("after making the circles equal:", await text("#status"));
  await shot("equal");

  // The first drag breaks the equality at level 1: the status reports it.
  await drag(1, 34, 0);
  log("after dragging M2:", await text("#status"));
  await shot("drag-one");

  // The second drag moves the apex, changing every radius at once.
  await drag(10, -18, -22);
  log("after dragging A:", await text("#status"));
  await shot("drag-two");

  if (!first) return;
  const n = await page.inputValue("#nInput");
  log("point count still:", n);
};
