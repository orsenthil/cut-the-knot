// Cabart Collinearity: two configurations of the same collinearity.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cabart-collinearity
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the Vecten case at 45 degrees, outer triangles and
  // the nine-point circle visible, after pulling B into a scalene triangle.
  await drag("B", 62, 28);
  await page.click("#showOuter");
  await page.click("#show9PC");
  await page.click("#showNames");
  log("45 degrees, outer triangles:", await text("#status"));
  await shot("vecten-45");

  if (!first) return; // the dark run only needs the second screenshot

  // Second configuration: reset, step the slider down to 30 degrees, show the
  // inner triangles instead, and make an obtuse triangle.
  await page.click("#newBtn");
  for (let i = 0; i < 3; i++) await page.click("#downBtn");
  await page.click("#showOuter");
  await page.click("#showInner");
  await drag("A", 74, -18);
  await drag("C", -48, 42);
  log("30 degrees, inner triangles:", await text("#status"));
  await shot("obtuse-30");

  // Keyboard: two arrow presses must leave focus on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Every button and both directions of the angle control, as a player would.
  await page.click("#upBtn");
  await page.click("#upBtn");
  log("after two +5 degree steps:", await text("#status"));
  await page.click("#downBtn");
  await page.click("#show9PC");
  await page.click("#showNames");
  await page.click("#showInner");
  await page.click("#showOuter");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
