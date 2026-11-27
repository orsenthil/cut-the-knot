// CentralAnglesInCube: an illustration, so two configurations rather than a
// win and a loss. The first shows both of the applet's angle groups with the
// tetrahedron and the view turned; the second frees a point and shows the
// acute angle alone. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs central-angles-in-cube
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: every group on, the largest zoom, the cube turned.
  await page.click("#bothBtn");
  await page.click("#tetraBtn");
  await page.click("#zoomIn");
  await page.click("#zoomIn");
  await page.click("#zoomIn");
  await page.click("#turnRight");
  await page.click("#turnRight");
  await page.click("#tiltUp");
  log("both angles, tetrahedron, zoomed:", await text("#status"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("both");

  // Second configuration: free a point, move it and show only the acute ray.
  await page.click("#snapBtn");
  await page.click("#acuteBtn");
  await drag("R", 46, -38);
  await page.click("#turnLeft");
  await page.click("#zoomOut");
  log("free point, acute angle:", await text("#status"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("acute-free");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: the moved handle must keep the focus.
  await handle("Q").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#snapBtn");       // snap back on
  await page.click("#noneBtn");
  await page.click("#obtuseBtn");
  await page.click("#acuteBtn");
  await page.click("#bothBtn");
  await page.click("#tetraBtn");      // hide
  await page.click("#tetraBtn");      // show again
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
