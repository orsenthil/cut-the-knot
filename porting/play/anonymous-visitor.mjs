// Anonymous Visitor: drag D to two configurations (external and internal
// triangles) and check that the status keeps reporting the same fixed C.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs anonymous-visitor
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

  // First configuration: D high above the base, small triangles outside ABD.
  await dragTo("D", 0.5, 0.12);
  await page.click("#namesBox");
  await page.click("#premiseBox");
  await page.click("#proofBox");
  log("D above the base:", await text("#status"));
  await shot("external");

  // Second configuration: D below the base, small triangles inside ABD.
  // Only D moved, so the reported position of C must be the same.
  await dragTo("D", 0.5, 0.92);
  log("D below the base:", await text("#status"));
  await shot("internal");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard-only moves keep the focus on the handle after each redraw.
  await handle("D").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every switch in both directions, a drag of each base end, then Reset.
  for (const id of ["#namesBox", "#premiseBox", "#proofBox"]) await page.click(id);
  await shot("minimal");
  for (const id of ["#premiseBox", "#proofBox", "#namesBox"]) await page.click(id);
  await dragTo("A", 0.24, 0.74);
  await dragTo("B", 0.78, 0.76);
  log("after dragging the base:", await text("#status"));
  await shot("base-moved");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
