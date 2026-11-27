// Eyeball 2: look at the default drawing, resize a circle, then make the
// tangents impossible; finish by pressing Reset.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs eyeball-2
export default async ({ page, first, log, shot, text }) => {
  const status = () => text("#status");

  async function drag(id, dx, dy) {
    const handle = page.locator(id);
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle " + id + " is not on the board");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  async function nudge(id, key, times, shift) {
    await page.locator(id).focus();
    for (let i = 0; i < times; i++) {
      await page.keyboard.press(shift ? "Shift+" + key : key);
    }
    const active = await page.evaluate(() => document.activeElement && document.activeElement.id);
    if (active !== id.slice(1)) throw new Error("focus left " + id + ": it is on " + active);
  }

  await shot("start");
  log("starting picture:", await status());

  // Two keyboard moves on the same handle: focus must survive the redraw.
  await nudge("#handle-A", "ArrowLeft", 2, false);
  log("after two arrow keys on A:", await status());

  // A pointer drag changes RB; the two radii still come out equal.
  await drag("#handle-boundaryB", 22, 0);
  log("after dragging B's rim:", await status());
  await shot("resized");

  // Pull B's centre left and stretch B's rim until A lies inside circle B:
  // there are no tangents from Q, and the status says so.
  await nudge("#handle-B", "ArrowLeft", 18, true);
  await nudge("#handle-boundaryB", "ArrowRight", 25, true);
  log("nested circles:", await status());
  await shot("impossible");

  if (!first) return;
  await page.click("#resetBtn");
  log("after Reset:", await status());
};
