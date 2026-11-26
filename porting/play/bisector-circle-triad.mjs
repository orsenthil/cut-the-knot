// Bisector Circle Triad: drag the corners to two different triangles and show
// the optional guides; an illustration has no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bisector-circle-triad
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
  await shot("start");

  // First configuration: a compact, acute triangle.
  await drag("A", 46, -18);
  await drag("C", -40, -22);
  log("after dragging A and C:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, then pull C into an obtuse triangle and
  // switch on every guide layer the applet offers.
  await page.click("#newBtn");
  await drag("C", 48, 16);
  for (const id of ["namesBtn", "bisectorsBtn", "reflectionsBtn", "smallBtn",
    "trianglesBtn", "bigBtn", "isogonalBtn"]) {
    await page.click(`#${id}`);
  }
  log("all guides shown:", await text("#status"));
  await shot("guides");

  if (!first) return; // the dark run only needs the screenshots above

  // Keyboard movement keeps focus on the handle; the picture follows.
  await corner("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await shot("checked");

  // Press every guide in the opposite direction, then reset once more.
  for (const id of ["isogonalBtn", "bigBtn", "trianglesBtn", "smallBtn",
    "reflectionsBtn", "bisectorsBtn", "namesBtn"]) {
    await page.click(`#${id}`);
  }
  log("all guides hidden:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
