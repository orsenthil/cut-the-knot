// Cevian Triangle: two different configurations of P and the triangle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cevian-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name === "P" ? "Point P" : "Corner " + name}"]`);
  const drag = async (name, dxBoard, dyBoard) => {
    const box = await handle(name).boundingBox();
    const board = await page.locator("#board").boundingBox();
    if (!box || !board) throw new Error(`no handle for ${name}`);
    const scale = board.width / 400; // the SVG viewBox is 400 units wide
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dxBoard * scale, y + dyBoard * scale, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move P towards the right-hand corner; keep the labels off.
  await drag("P", 40, -10);
  await page.click("#checkBtn");
  log("after moving P and checking:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: reset, reshape the triangle, move P, show the labels.
  await page.click("#newBtn");
  await drag("C", 30, 20);
  await drag("P", 20, -10);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("after reshaping and showing names:", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and redraws the picture.
  await handle("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
