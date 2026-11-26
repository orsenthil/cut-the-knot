// Bottema: drag the triangle into two different configurations and watch the
// two squares and the midpoint of the segment between their far corners.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bottema
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: carry C to the far left, changing both squares.
  await drag("C", -118, -52);
  log("after dragging C:", await text("#status"));
  await shot("far-left");

  // Second configuration: reset and move the base points as well.
  await page.click("#newBtn");
  await drag("A", 46, 34);
  await drag("B", -62, 38);
  log("after moving A and B:", await text("#status"));
  await shot("shifted-base");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the diagram follows.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  await page.click("#linesBtn");
  await page.click("#hintBtn");
  log("with lines and hint:", await text("#status"));
  await shot("hint");

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await page.click("#hintBtn");
  await page.click("#linesBtn");
  await page.click("#namesBtn");
  log("after hiding everything:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
