// ABisector: drag the corners to two different triangles and look at the diagram.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs a-bisector
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

  // First configuration: pull A toward the middle, making a compact triangle.
  await drag("A", 68, -26);
  log("after dragging A:", await text("#status"));
  await shot("compact");

  // Second configuration: start again and pull B right, making an obtuse one.
  await page.click("#newBtn");
  await drag("B", 112, 15);
  log("after dragging B:", await text("#status"));
  await shot("obtuse");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the picture follows.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await shot("checked");

  await page.click("#circlesBtn");
  await page.click("#circlesBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
