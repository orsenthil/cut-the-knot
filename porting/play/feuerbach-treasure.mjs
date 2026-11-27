// Feuerbach Treasure: two configurations of the four triangles, then the
// keyboard and every button. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs feuerbach-treasure
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}."]`);
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

  // First configuration: all four triangles selected, sixteen touching circles.
  await page.click("#allBtn");
  log("all four:", await text("#status"));
  await shot("all-four");

  // Second configuration: drag a corner so the orthocenter moves far away.
  await drag("A", 52, -26);
  log("after dragging A:", await text("#status"));
  log("selected circles:", await page.locator("#board .feuer-circle:not([style*='none'])").count());
  await shot("moved-corner");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard: two arrow keys keep focus on the corner handle.
  await page.click("#newBtn");
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button the page has, in the order a player would: show all,
  // hide the four one at a time, toggle names, show all again, then reset.
  for (const id of ["allBtn", "abcBtn", "abhBtn", "bchBtn", "cahBtn", "namesBtn", "allBtn"]) {
    await page.click(`#${id}`);
  }
  log("all toggles on:", await text("#status"));
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
