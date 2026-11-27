// Existence of the Circumcenter: two configurations, one with the bisectors
// meeting outside the triangle and one with the completed circumcircle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs existence-of-circumcenter
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
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

  // First configuration: pull C down and right so the angle at A is obtuse
  // and the meeting point of the bisectors moves outside the triangle.
  await drag("Corner C", 26, 24);
  log("after dragging C:", await text("#status"));
  await shot("outside");

  // Second configuration: reset, move B, then put the three dots at the
  // middles so the applet's circle appears.
  await page.click("#newBtn");
  await drag("Corner B", -18, -40);
  await page.click("#snapBtn");
  log("after snapping the dots:", await text("#status"));
  log("status classes:", await page.getAttribute("#status", "class"));
  await shot("circumcircle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard-only movement: focus must stay on the handle after each move.
  await handle("Corner A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  await handle("Dot L").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  log("status after moving a dot with the keyboard:", await text("#status"));

  await page.click("#namesBtn");
  log("after Hide names:", await text("#namesBtn"));
  await page.click("#namesBtn");
  log("after Show names:", await text("#namesBtn"));
  await page.click("#snapBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
