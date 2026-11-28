// Menelaus Bisector: two configurations of the illustration. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs menelaus-bisector
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#board .geom-handle");
  log("on load:", await text("#status"));

  // Configuration 1: three internal bisectors meet at the incenter.
  await page.click("#mode3");
  log("configuration 1 (3 in, 0 out):", await text("#status"));
  await shot("concurrent");

  // Configuration 2: three external bisectors give collinear outside feet.
  await page.click("#mode3");
  await page.click("#mode0");
  log("configuration 2 (0 in, 3 out):", await text("#status"));
  await shot("collinear");

  if (!first) return; // the dark run only needs the two screenshots above

  // Every box, in both directions, and the red-triangle picture.
  for (const id of ["#mode2", "#mode1", "#mode3"]) {
    await page.click(id);
    log(id, "on:", await text("#status"));
  }
  for (const id of ["#mode0", "#mode3", "#mode1", "#mode2"]) {
    await page.click(id);
    log(id, "off:", await text("#status"));
  }

  // Two arrow keys keep the keyboard focus on the moved vertex.
  const handleA = page.locator('#board [aria-label^="Vertex A"]');
  await handleA.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));

  const handleC = page.locator('#board [aria-label^="Vertex C"]');
  const box = await handleC.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 25, box.y + box.height / 2 + 18, { steps: 8 });
    await page.mouse.up();
  }
  log("after dragging C:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.keyboard.press("r");
  log("after the r shortcut:", await text("#status"));
};
