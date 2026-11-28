// JLAyme: one configuration with the first proof step, then a second with all
// four steps and a changed triangle — two pictures in both colour schemes.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs jl-ayme
export default async ({ page, first, log, shot, text }) => {
  async function drag(index, dx, dy) {
    const handle = page.locator("#board .geom-handle").nth(index);
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle " + index + " is not on the board");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 14 });
    await page.mouse.up();
  }

  await shot("start");
  log("at the start:", await text("#status"));

  // First configuration: slide D along BC and reveal the incenter and step 1.
  await drag(3, -38, 0);
  log("after dragging D:", await text("#status"));
  await page.click("#statementChk");
  await page.click("#step1Chk");
  log("with statement and step 1:", await text("#status"));
  await shot("step1");

  if (!first) return;

  // Keyboard alone: focus B, move it twice, and check the focus stays on the
  // board after the redraw (B, C and D move together, as in the applet).
  const bHandle = page.locator("#board .geom-handle").nth(1);
  await bHandle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focus);
  log("after keyboard moves:", await text("#status"));

  // Second configuration: all steps on, and a different triangle and D.
  await page.click("#allBtn");
  await drag(0, 48, 26);
  log("after dragging A:", await text("#status"));
  await drag(2, -44, -18);
  log("after dragging C:", await text("#status"));
  await shot("all-steps");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
