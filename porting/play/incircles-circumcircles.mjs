// Incircles Circumcircles: two configurations of the illustration, with the
// applet's circle toggles on and the theorem checked in each one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs incircles-circumcircles
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const handle = corner(name);
    const box = await handle.boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("starting picture:", await text("#status"));
  await shot("start");

  // Configuration 1: the incircle and the big circumcircle, on a scalene triangle.
  await page.click("#showIncircle");
  await page.click("#showBig");
  await drag("A", 38, 22);
  await drag("B", -22, 34);
  await page.click("#checkBtn");
  log("first configuration:", await text("#status"));
  await shot("first");

  if (!first) return; // the dark run needs only the screenshots above

  // Keyboard-only moves must leave focus on the board after a redraw.
  await corner("C").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  await page.click("#checkBtn");

  // Configuration 2: the three small circumcircles on a very different
  // (obtuse) triangle, with the big circle still shown.
  await page.click("#newBtn");
  await page.click("#showSmall");
  await drag("B", -104, -18);
  await drag("C", -48, 62);
  await page.click("#checkBtn");
  log("second configuration:", await text("#status"));
  await shot("second");

  // Press every control in both directions, in the order a player would.
  await page.click("#showIncircle");
  await page.click("#showIncircle");
  await page.click("#showSmall");
  await page.click("#showSmall");
  await page.click("#showBig");
  await page.click("#showBig");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
