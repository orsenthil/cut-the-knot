// Angle Bisector In Rectangle: drag two corners into different rectangles and
// read the two angle measurements each time.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-bisector-in-rectangle
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="${name} ("]`);
  const pHandle = () => page.locator('#board [aria-label^="P on side CD"]');
  const drag = async (locator, dx, dy) => {
    await idle();
    const box = await locator.boundingBox();
    if (!box) throw new Error("no handle to drag");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull A right and down, making a smaller rectangle.
  await drag(corner("A"), 40, 26);
  await page.click("#checkBtn");
  log("after dragging A:", await text("#status"));
  await shot("small-rectangle");

  // Second configuration: reset, then pull D left and down, making a taller
  // rectangle whose right side (and P with it) moves left.
  await page.click("#newBtn");
  await drag(corner("D"), -46, 34);
  await drag(pHandle(), 0, -22);
  await page.click("#checkBtn");
  log("after dragging D and P:", await text("#status"));
  await shot("tall-rectangle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard: two arrow keys on a corner keep the focus on that corner.
  await corner("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused.slice(0, 60));
  log("status after keyboard:", await text("#status"));

  // Every option in both directions, and the reset at the end.
  for (const id of ["namesBtn", "statementBtn", "hintBtn"]) {
    await page.click(`#${id}`);
    log(`${id} on:`, await page.getAttribute(`#${id}`, "aria-pressed"));
    await page.click(`#${id}`);
    log(`${id} off:`, await page.getAttribute(`#${id}`, "aria-pressed"));
  }
  await page.click("#checkBtn");
  log("after Check:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
