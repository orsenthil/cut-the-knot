// Euler to Euler: two triangle configurations, then keyboard and every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-to-euler
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

  // First configuration: a scalene triangle with M and N on the two sides.
  await drag("A", 18, 8);
  await drag("C", -10, 6);
  await page.click("#namesBtn");
  await page.click("#eulerBtn");
  log("first configuration:", await text("#status"));
  await shot("parallel");

  // Second configuration: reset, pull B and C the other way, show the centres.
  await page.click("#newBtn");
  await drag("B", -22, 12);
  await drag("C", 16, -8);
  await page.click("#centroidBtn");
  await page.click("#circumBtn");
  await page.click("#orthoBtn");
  log("second configuration:", await text("#status"));
  await shot("centres");

  if (!first) return; // the dark run only needs the two screenshots above

  // Arrow keys move a corner and leave focus on that same handle.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in both directions, then reset.
  for (const id of ["#eulerBtn", "#namesBtn", "#centroidBtn", "#circumBtn", "#orthoBtn"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
