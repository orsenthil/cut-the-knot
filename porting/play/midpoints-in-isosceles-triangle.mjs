// MidpointsInIsoscelesTriangle: two triangle shapes, then keyboard and buttons.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs midpoints-in-isosceles-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: show the applet's statement mark and pull A toward
  // the base, making a short, wide isosceles triangle.
  await page.click("#statementBtn");
  await drag("Apex A", 0, 34);
  await page.click("#checkBtn");
  log("short triangle:", await text("#status"));
  await shot("short-apex");

  // Second configuration: reset, then move C; B is mirrored by the applet's
  // UpgradePoints rule. Toggle the three options both ways as a player would.
  await page.click("#newBtn");
  await drag("Base corner C", -62, -26);
  await page.click("#extraBtn");
  await page.click("#extraBtn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("mirrored base:", await text("#status"));
  await shot("mirrored-base");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: the handle keeps focus and the picture follows.
  await handle("Apex A").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await page.click("#checkBtn");
  log("after checking:", await text("#status"));
  await page.click("#statementBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
