// Equi Tri In Rec: two configurations of the draggable parallelogram. It is a
// demonstration with no win or loss, so each drag just explores the picture.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equi-tri-in-rec
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board .geom-handle[aria-label^="Point ${name}"]`);
  const dragTo = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const h = await handle(name).boundingBox();
    if (!board || !h) throw new Error(`no board or handle for ${name}`);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 14 });
    await page.mouse.up();
  };

  await page.waitForSelector("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: pull D right and up into a slanted parallelogram,
  // with every overlay the Java panel offers switched on.
  await dragTo("D", 0.78, 0.18);
  for (const id of ["#namesBox", "#statementBox", "#premiseBox", "#hintBox"]) await page.click(id);
  log("slanted, all overlays:", await text("#status"));
  await shot("slanted");

  // Second configuration: pull A down and left; Q now lands on the extension
  // of CD rather than on the side itself.
  for (const id of ["#namesBox", "#statementBox", "#premiseBox", "#hintBox"]) await page.click(id);
  await dragTo("A", 0.16, 0.82);
  await page.click("#premiseBox");
  log("A dragged down:", await text("#status"));
  await shot("dragged");

  if (!first) return; // the dark run only needs the three screenshots above

  // Keyboard-only moves keep the focus on the handle after the redraw.
  await handle("D").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // Every switch in both directions, then Reset back to the rectangle.
  for (const id of ["#namesBox", "#statementBox", "#premiseBox", "#hintBox"]) await page.click(id);
  await shot("overlays");
  for (const id of ["#hintBox", "#premiseBox", "#statementBox", "#namesBox"]) await page.click(id);
  await dragTo("B", 0.62, 0.7);
  await dragTo("C", 0.82, 0.62);
  log("after B and C:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
