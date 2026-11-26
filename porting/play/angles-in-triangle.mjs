// Angles in a Triangle: drag the triangle into two folding configurations,
// then open the 120-degree exercise and move its point D.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angles-in-triangle
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
    await idle();
  };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("folding-opening");

  // First configuration: move A and C so a different corner is largest.
  await drag("A", 26, -18);
  await drag("C", -14, -10);
  log("after dragging A and C:", await text("#status"));
  await shot("folding-dragged");

  // Second configuration: the exercise, and then a moved point D.
  await page.click("#exerciseBtn");
  await idle();
  log("exercise:", await text("#status"));
  await shot("exercise");
  await drag("D", -14, -16);
  log("after dragging D:", await text("#status"));
  await shot("exercise-dragged");

  if (!first) return; // the dark run only needs the same four screenshots

  // Keyboard-only moves keep focus on the handle and update the reading.
  await handle("D").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every option in both directions, and every button in player order.
  await page.click("#namesBox");
  await page.click("#namesBox");
  await page.click("#foldingBtn");
  await page.click("#exerciseBtn");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"),
    "| names:", await page.isChecked("#namesBox"),
    "| exercise pressed:", await page.getAttribute("#exerciseBtn", "aria-pressed"));
};
