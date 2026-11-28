// Mc Worter 2: two configurations of the similar parallelograms and their
// fixed midpoint. There is nothing to win, so these are screenshots of two
// different diagrams; on the light run we also press every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs mcworter-2
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
  const slide = (id, value) => page.locator(`#${id}`).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: carry C across the board, so both flanks change.
  await drag("C", -104, 42);
  log("after dragging C left:", await text("#status"));
  await shot("dragged-c");

  // Second configuration: move the base too, stretch the flanks and tilt them.
  await page.click("#newBtn");
  await drag("A", 40, 28);
  await drag("B", -52, 32);
  await slide("coef", 25);
  await slide("angle", -40);
  log("after stretching and tilting:", await text("#status"));
  await shot("stretched");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard play: focus survives the redraw after each arrow key.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Every button, then every option in both directions.
  await page.click("#namesBtn");
  log("names hidden:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));

  await page.locator("#coef").focus();
  await page.keyboard.press("Home");
  log("lowest scale:", await text("#status"));
  await page.click("#checkBtn"); // the angles are undefined here: the page says so
  log("checking the collapsed diagram:", await text("#status"));
  await page.locator("#coef").focus();
  await page.keyboard.press("End");
  log("highest scale:", await text("#status"));
  await slide("coef", 0);

  await page.locator("#angle").focus();
  await page.keyboard.press("Home");
  log("lowest turn:", await text("#status"));
  await page.keyboard.press("End");
  log("highest turn:", await text("#status"));
  await slide("angle", 0);

  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
