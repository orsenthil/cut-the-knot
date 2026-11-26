// Angle Bisector Ratio: drag the corners to two different triangles and watch
// the bisector foot D and the two matching ratios.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle-bisector-ratio
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

  // First configuration: pull C right so AB is much longer than AC, then
  // reveal the proof construction and the equal-step hint.
  await drag("C", 110, -18);
  log("after dragging C:", await text("#status"));
  await page.click("#extraBtn");
  await page.click("#hintBtn");
  await shot("scalene-construction");

  // Second configuration: start again and pull A left into an obtuse shape.
  await page.click("#newBtn");
  await drag("A", -95, -30);
  log("after dragging A:", await text("#status"));
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
  log("after Check the ratio:", await text("#status"));
  await shot("checked");

  // Press every button in player order, toggling each option both ways.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#extraBtn");
  await page.click("#extraBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
