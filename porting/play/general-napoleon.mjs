// General Napoleon: two configurations of the same illustration.
// It has no win or loss, so the scenario shows the isotomic case and then a
// non-isotomic case where the three lines need not meet.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs general-napoleon
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
  const setRange = (id, value) => page.locator(`#${id}`).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: isotomic points at the defaults (30 + 70 = 1),
  // a moved corner, and no labels, like the page's first applet.
  await drag("A", -16, 8);
  await page.click("#names");
  log("first (isotomic):", await text("#status"));
  await shot("first");

  // Second configuration: reset, then break the isotomic condition and
  // change the base angle, as the second slider is meant to be changed.
  await page.click("#resetBtn");
  await setRange("up", 30);
  await setRange("down", 40);
  await setRange("angle", 45);
  await drag("C", -26, -10);
  await page.click("#names");
  log("second (not isotomic):", await text("#status"));
  await shot("second");

  if (!first) return; // dark run only needs the two screenshots

  // Two keyboard-only moves; focus must stay on the moved corner.
  await corner("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Every control in a player's order, in both directions.
  await setRange("up", 0);
  await setRange("up", 105);
  await setRange("up", 30);
  await setRange("down", 0);
  await setRange("down", 105);
  await setRange("down", 40);
  await setRange("angle", -90);
  await setRange("angle", 95);
  await setRange("angle", 45);
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
