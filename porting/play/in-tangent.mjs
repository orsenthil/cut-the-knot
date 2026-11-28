// In Tangent: two configurations, one ordinary X and one parked at T.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs in-tangent
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
  log("starting picture:", await text("#status"));

  // Configuration 1: the circle on, then two keyboard moves on X.
  await page.click("#circleChk");
  log("with the circle:", await text("#status"));
  await shot("circle");
  await page.locator("#board .geom-handle").nth(3).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  if (first) {
    log("focus after two arrow keys:", await page.evaluate(() =>
      document.activeElement && document.activeElement.getAttribute("aria-label")));
  }
  log("after moving X by keyboard:", await text("#status"));
  await shot("keyboard");

  // Drag the apex: the tangent and both small circles follow it.
  await drag(0, -20, -16);
  log("after dragging A:", await text("#status"));
  await shot("new-apex");

  // Configuration 2: X coincides with T, so the applet's eyes light up.
  await page.click("#toTBtn");
  log("with X at T:", await text("#status"));
  if (first) {
    log("lit eyes:", await page.locator("#board .eye.on").count());
    log("status class:", await page.getAttribute("#status", "class"));
  }
  await shot("at-t");

  if (!first) return;
  await page.click("#resetBtn");
  log("after New diagram:", await text("#status"));
};
