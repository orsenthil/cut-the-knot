// Brianchon: two different hexagons around the circle; no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs brianchon
export default async ({ page, first, log, shot, idle, text }) => {
  const dot = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await dot(name).boundingBox();
    if (!box) throw new Error(`no handle for dot ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull A and C, making a compact hexagon.
  await drag("A", 52, 38);
  await drag("C", -34, -30);
  log("compact hexagon:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, then spread D and F into a long hexagon.
  await page.click("#newBtn");
  await drag("D", -58, 18);
  await drag("F", 44, -34);
  await page.click("#checkBtn");
  log("stretched hexagon, checked:", await text("#status"));
  await shot("stretched");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps the focus on the dot; the picture follows.
  await dot("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in the order a player would, in both directions.
  await page.click("#checkBtn");
  log("after Check the theorem:", await text("#status"));
  await page.click("#addonsBtn");
  log("after Additional Concurrencies:", await page.getAttribute("#addonsBtn", "aria-pressed"));
  await page.click("#extendBtn");
  log("after Extend Lines:", await page.getAttribute("#extendBtn", "aria-pressed"));
  await page.click("#checkBtn");
  await page.click("#extendBtn");
  await page.click("#addonsBtn");
  log("after toggling back:", await page.getAttribute("#addonsBtn", "aria-pressed"),
    await page.getAttribute("#extendBtn", "aria-pressed"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
