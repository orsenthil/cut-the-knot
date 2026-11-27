// Droz Farny Circles: two configurations of the same illustration — the two
// equal-radius circles with their six cut points, then another triangle with
// the angle marks. There is no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs droz-farny-circles
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board .geom-handle[aria-label^="${name}"]`);
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
  log("start:", await text("#status"));

  // Configuration 1: both circle families, perpendiculars, radii and names.
  await page.check("#circlesPBox");
  await page.check("#circlesQBox");
  await page.check("#perpsBox");
  await page.check("#radiiBox");
  await page.check("#namesBox");
  await drag("Point P", 26, -22);
  const circles = await text("#status");
  log("two circles:", circles);
  if (first && !/Both circles have radius/.test(circles)) {
    throw new Error("the status should report both equal-radius circles");
  }
  const radiiEnabled = await page.isEnabled("#radiiBox");
  if (first && !radiiEnabled) throw new Error("radii should be enabled while a circle family is shown");
  await shot("two-circles");

  // Configuration 2: a different triangle and P, with angle marks instead.
  await page.click("#newBtn");
  await drag("Corner A", 20, -10);
  await drag("Corner C", -16, 12);
  await drag("Point P", -20, -10);
  await page.check("#circlesPBox");
  await page.check("#circlesQBox");
  await page.check("#anglesBox");
  await page.check("#namesBox");
  const angles = await text("#status");
  log("moved triangle and P:", angles);
  if (first && !/Both circles have radius/.test(angles)) {
    throw new Error("the two circles should still agree after moving the triangle");
  }
  await shot("angles");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: two arrow presses on P; focus must stay on that handle.
  await handle("Point P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  if (!/^Point P/.test(focused)) throw new Error("focus left the P handle");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, including the disabled state of
  // radii when no circles are shown.
  for (const id of ["#anglesBox", "#perpsBox", "#circlesPBox", "#circlesQBox"]) {
    await page.uncheck(id);
    await page.check(id);
  }
  await page.uncheck("#circlesPBox");
  await page.uncheck("#circlesQBox");
  if (await page.isEnabled("#radiiBox")) throw new Error("radii should be disabled without circles");
  for (const id of ["#circlesPBox", "#circlesQBox", "#radiiBox", "#namesBox", "#anglesBox", "#perpsBox"]) {
    await page.check(id);
  }
  log("all guides shown:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  if (await page.isEnabled("#radiiBox")) throw new Error("Reset should disable radii again");
};
