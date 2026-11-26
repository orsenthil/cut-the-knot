// BOL3: drag P to two different places on the circle and take a screenshot of each.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-3
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = page.locator('#board [aria-label^="Point P"]');
  const drag = async (dx, dy) => {
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle for P");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull P up and over the top of the circle.
  await drag(80, -46);
  log("after dragging P up:", await text("#status"));
  await shot("up");

  // Second configuration: reset, then take P down to the far side of the circle.
  await page.click("#resetBtn");
  await drag(150, 180);
  log("after dragging P down:", await text("#status"));
  await shot("down");

  if (!first) return; // the dark run only needs the two screenshots

  await page.click("#checkBtn");
  log("after Check the lengths:", await text("#status"));
  await page.click("#marksBtn");
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  log("with all options on:", await text("#status"));
  await shot("options");

  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#marksBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
