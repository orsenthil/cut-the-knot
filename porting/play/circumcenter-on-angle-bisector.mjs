// Circumcenter on Angle Bisector: two configurations, then the toggles and keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circumcenter-on-angle-bisector
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

  // First configuration: pull A toward the middle for a compact triangle.
  await drag("A", 48, -18);
  log("after dragging A:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, then lift A up into a tall triangle.
  await page.click("#newBtn");
  await drag("A", -10, -40);
  log("after dragging A up:", await text("#status"));
  await shot("tall");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement keeps focus on the handle; the construction follows.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // The four applet toggles, each pressed on and off.
  for (const id of ["namesBtn", "statementBtn", "premiseBtn", "hintBtn"]) {
    await page.click(`#${id}`);
    log(`${id} on:`, await text("#status"));
    await page.click(`#${id}`);
  }
  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await shot("checked");

  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
