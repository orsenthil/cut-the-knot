// Isogonal Image of the Circumcircle: the opening picture (P on the circle,
// parallel lines), then P pulled inside so the lines meet at Q, then the
// whole triangle dragged. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circumsogonal
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (loc, dx, dy) => {
    const box = await loc.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("parallel");

  await drag(handle("Point P"), 60, 20);
  log("P inside:", await text("#status"));
  await shot("meet-at-q");
  if (!first) return;

  // Keyboard alone: two arrow presses on P, and focus stays on it.
  await handle("Point P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  log("after keys:", await text("#status"));

  // Drag the triangle's inside, then a corner, then snap P back on the circle.
  await drag(page.locator("#board .tri-body"), -20, 10);
  await drag(handle("Corner A"), 10, -15);
  log("moved triangle:", await text("#status"));
  await page.click("#snapBtn");
  log("after P on circle:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
