// BimediansInTetrahedron: an illustration, so two configurations rather than
// a win and a loss. The second one is the regular tetrahedron with its cube.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bimedians-in-tetrahedron
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: break the symmetry, show the cube and turn the view.
  await drag("D", 44, -26);
  await page.click("#skewBtn");
  await page.click("#cubeBtn");
  await page.click("#turnRight");
  await page.click("#tiltUp");
  log("skewed with cube:", await text("#status"));
  await shot("skewed");

  // Second configuration: the regular tetrahedron in its cube, zoomed in.
  await page.click("#resetBtn");
  await page.click("#turnLeft");
  await page.click("#turnLeft");
  await page.click("#tiltDown");
  await page.click("#zoomIn");
  log("regular with cube:", await text("#status"));
  await shot("regular");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: the moved corner must keep the focus.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#cubeBtn");       // hide
  await page.click("#cubeBtn");       // show again
  await page.click("#skewBtn");
  await page.click("#resetBtn");
  await page.click("#turnLeft");
  await page.click("#turnRight");
  await page.click("#tiltUp");
  await page.click("#tiltDown");
  await page.click("#zoomOut");
  await page.click("#zoomOut");
  await page.click("#zoomIn");
  await page.click("#zoomIn");
  log("after every button:", await text("#status"));
};
