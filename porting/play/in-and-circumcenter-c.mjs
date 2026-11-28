// In And Circumcenter C: two configurations of the draggable triangle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs in-and-circumcenter-c
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board .geom-handle[aria-label^="Point ${name}"]`);
  const dragTo = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const h = await handle(name).boundingBox();
    if (!board || !h) throw new Error(`no board or handle for ${name}`);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  await page.waitForSelector("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: C on the locus where angle C is 30 degrees.
  // DE and IO are then the same length and still meet at right angles.
  await dragTo("C", 0.5, 94.05 / 400);
  await page.click("#centerBox");
  await page.click("#namesBox");
  log("angle C near 30:", await text("#status"));
  await shot("thirty-degrees");

  // Second configuration: a long, lopsided triangle with every optional
  // circle on. The right angle remains; the equality no longer holds.
  await dragTo("A", 0.14, 0.84);
  await dragTo("B", 0.86, 0.62);
  await page.click("#circleABox");
  await page.click("#circleBBox");
  await page.click("#circleCBox");
  log("another triangle:", await text("#status"));
  await shot("lopsided");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard-only moves keep the focus on the handle after each redraw.
  await handle("C").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every switch in both directions, then Reset.
  for (const id of ["#namesBox", "#centerBox", "#circleABox", "#circleBBox", "#circleCBox"]) await page.click(id);
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
