// Balls In Jar: two configurations -- a tilted small-bottle stack and a
// level stack at the largest slider value.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs balls-in-jar
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board .geom-handle[aria-label^="${name}"]`);
  const slider = page.locator("#sizeInput");
  const setSize = (value) => slider.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  const drag = async (locator, dx) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("no handle to drag");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");

  // First configuration: the smallest bottles, B pushed against A.
  await setSize(0);
  await drag(handle("Middle bottle B"), -120);
  await page.click("#hintsBtn");
  log("small bottles, B left:", await text("#status"));
  await shot("tilted-left");

  // Second configuration: reset, then the largest slider value, B to the right.
  await page.click("#newBtn");
  await setSize(105);
  await drag(handle("Middle bottle B"), 120);
  log("largest bottles, B right:", await text("#status"));
  await shot("level-largest");

  if (!first) return; // the dark run needs only the two screenshots

  // Keyboard alone moves the middle handle and keeps focus after the redraw.
  await handle("Middle bottle B").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#hintsBtn");
  log("after toggling names and hint:", await text("#status"));
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
