// Bevan Point: two triangle configurations, then the keyboard and every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bevan-point
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

  // First configuration: a compact, slightly skewed triangle.
  await drag("A", 26, 16);
  await drag("C", -16, 12);
  log("after first configuration:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, then pull B and C to make an obtuse triangle.
  await page.click("#newBtn");
  await drag("B", -38, 24);
  await drag("C", 24, -8);
  await page.click("#namesBtn");
  await page.click("#claim1Btn");
  await page.click("#claim2Btn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("after second configuration:", await text("#status"));
  await shot("obtuse");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement keeps focus on the handle and redraws the diagram.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button, both directions, in the order a player would.
  await page.click("#checkBtn");
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#claim2Btn");
  await page.click("#claim2Btn");
  await page.click("#claim1Btn");
  await page.click("#claim1Btn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
