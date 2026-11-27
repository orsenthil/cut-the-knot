// Circle In Isosceles Triangle: two configurations of the same theorem.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-in-isosceles-triangle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: slide P to the midpoint of AB, so Q reaches the
  // midpoint of CA too. The circle through the three midpoints is symmetric.
  await drag("Point P", 17, -32);
  log("after moving P to the midpoint:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: reset, widen the base (C mirrors B) and slide Q.
  await page.click("#newBtn");
  await drag("Corner B", -35, -11);
  await drag("Point Q", 16, 4);
  await page.click("#checkBtn");
  log("after a wide base with Check:", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and the picture follows.
  await handle("Point Q").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  for (const id of ["#namesBtn", "#premiseBtn", "#statementBtn", "#hintBtn"]) {
    await page.click(id);
    await page.click(id);
  }
  log("after all four toggles:", await text("#status"));
  await page.click("#checkBtn");
  log("after Check again:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
