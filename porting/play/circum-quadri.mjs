// Circum Quadri: two different quadrilaterals around the circle; no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circum-quadri
export default async ({ page, first, log, shot, idle, text }) => {
  const dot = (name) => page.locator(`#board [aria-label^="Touch point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await dot(name).boundingBox();
    if (!box) throw new Error(`no handle for touch point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull A down and C up into a compact quadrilateral.
  await drag("A", 62, 44);
  await drag("C", -48, -38);
  await page.click("#checkBtn");
  log("compact quadrilateral:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, then spread B and D into a tall shape.
  await page.click("#newBtn");
  await drag("B", -52, 30);
  await drag("D", 46, -34);
  await page.click("#checkBtn");
  log("tall quadrilateral:", await text("#status"));
  await shot("tall");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the dot that was moved.
  await dot("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press both buttons in the order a player would, in both directions.
  await page.click("#checkBtn");
  log("after Check the theorem:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset diagram:", await text("#status"));
  await page.click("#checkBtn");
  log("after checking the start:", await text("#status"));
};
