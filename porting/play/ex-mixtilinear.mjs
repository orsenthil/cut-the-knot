// Ex Mixtilinear: drag K to one position, snap to the equal-radius position,
// then change the triangle — two configurations in both colour schemes.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs ex-mixtilinear
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

  // First configuration: K slides along BC, so only the two circles change.
  await drag(3, -34, 0);
  log("after dragging K along BC:", await text("#status"));
  await shot("k-moved");

  // The applet's special position: K is the incircle's contact point.
  await page.click("#snapBtn");
  log("after Find equal circles:", await text("#status"));
  await shot("equal");

  if (!first) return;

  // Keyboard alone: focus K, move it twice, and check focus stays on the board.
  const kHandle = page.locator("#board .geom-handle").nth(3);
  await kHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focus);
  log("after keyboard moves:", await text("#status"));

  // Second configuration: change the triangle itself, keeping the new K.
  await drag(0, 28, 22);
  log("after dragging A:", await text("#status"));
  await page.click("#hintChk");
  log("with the hint on:", await text("#status"));
  await shot("hint");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
