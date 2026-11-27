// Euler and Fermat: two configurations of the same concurrency.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-and-fermat
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
  const focusLabel = () => page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a scalene triangle with all point names and the
  // five marked special angles visible.
  await drag("B", -42, 30);
  await drag("C", 28, -12);
  await page.click("#showNames");
  await page.click("#showAngles");
  log("named, with special angles:", await text("#status"));
  await shot("named-angles");

  if (!first) return; // the dark run only needs the second screenshot

  // Second configuration: reset, then an obtuse triangle with only the
  // Euler lines showing.
  await page.click("#newBtn");
  await drag("A", 54, -6);
  await drag("C", -56, 58);
  log("after reset and two drags:", await text("#status"));
  await shot("obtuse");

  // Keyboard: two arrow presses must leave focus on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:", await focusLabel());
  log("status after keyboard:", await text("#status"));

  // Every control, both directions: the two checkboxes and Reset.
  await page.click("#showAngles");
  await page.click("#showNames");
  await page.click("#showAngles");
  await page.click("#showNames");
  await page.click("#newBtn");
  log("after toggles and reset:", await text("#status"));
};
