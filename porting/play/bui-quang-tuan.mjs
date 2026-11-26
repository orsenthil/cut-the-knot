// Bui Quang Tuan: set up two different six-circle chains and look at them.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bui-quang-tuan
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move a corner and slide the first circle's centre.
  await drag("A2", 28, -30);
  await drag("P", -18, 14);
  log("after moving A2 and P:", await text("#status"));
  await shot("corner-and-centre");

  // Second configuration: a fresh triangle, a different corner and centre.
  await page.click("#newBtn");
  await drag("A3", -36, 26);
  await drag("P", 26, -22);
  log("after moving A3 and P:", await text("#status"));
  await shot("other-corner");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and redraws the chain.
  await handle("A1").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in the order a player would.
  await page.click("#namesBtn");
  await page.click("#joinBtn");
  await page.selectOption("#pairSel", "3");
  log("pair 3 highlighted:", await text("#status"));
  await shot("labelled-and-joined");
  await page.selectOption("#pairSel", "0");
  await page.click("#namesBtn");
  await page.click("#joinBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
