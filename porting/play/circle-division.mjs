// Circle Division: two configurations of the draggable points, then the two
// options and the keyboard. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs circle-division
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board circle[role="button"][aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: move both points round the circle and show everything.
  await drag("A", 74, 18);
  await drag("C", -52, 26);
  await page.click("#namesBox");
  await page.click("#hintBox");
  log("after dragging:", await text("#status"),
    "| status class:", await page.getAttribute("#status", "class"));
  await shot("configuration-2");

  // Keyboard-only moves keep the focus on the handle after the redraw.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every button in the order a player would meet them, in both directions.
  await page.click("#hintBox");
  await page.click("#namesBox");
  await page.click("#namesBox");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"), "| status class:", await page.getAttribute("#status", "class"));
  if (!first) return; // the dark run only needs the screenshots above
};
