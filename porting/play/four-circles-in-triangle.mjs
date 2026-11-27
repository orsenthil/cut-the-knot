// Four Circles In Triangle: the starting triangle, then a dragged one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-circles-in-triangle
export default async ({ page, first, log, shot, text }) => {
  await page.locator("#stage").scrollIntoViewIfNeeded();
  await shot("starting-triangle");
  log("starting configuration:", await text("#status"));

  // Drag the lower-left corner to a new place; the four circles follow.
  const handle = page.locator("#board .geom-handle").nth(1);
  const box = await handle.boundingBox();
  if (!box) throw new Error("vertex B is not on the board");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 52, y - 38, { steps: 12 });
  await page.mouse.up();
  log("after dragging B:", await text("#status"));
  await shot("dragged-triangle");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two keyboard-only moves, and the focus should stay on the moved vertex.
  const apex = page.locator("#board .geom-handle").nth(0);
  await apex.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("after two arrow keys:", await text("#status"));
  log("focused element:", await page.evaluate(() =>
    document.activeElement ? document.activeElement.getAttribute("aria-label") : "none"));

  // Exercise every control in the order a player would, then restore the board.
  await page.click("#pointsChk");
  log("touch points hidden:", await text("#status"));
  await page.click("#pointsChk");
  await page.click("#linesChk");
  log("joining lines hidden:", await text("#status"));
  await page.click("#linesChk");
  await page.click("#namesChk");
  log("labels shown:", await text("#status"));
  await page.click("#namesChk");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
