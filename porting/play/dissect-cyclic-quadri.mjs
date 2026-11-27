// Dissect Cyclic Quadri: two configurations of the same cyclic quadrilateral.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs dissect-cyclic-quadri
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (label, dx, dy) => {
    await page.locator("#board").scrollIntoViewIfNeeded();
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };
  const status = async () => text("#status");

  await idle("#board .geom-handle");
  log("start:", await status());

  // First configuration: the article's perpendicular-foot dissection.
  await page.click("#feetBtn");
  await page.click("#names");
  await page.click("#helper");
  await shot("feet");
  log("perpendicular feet:", await status());

  // Second configuration: move a corner and P, then rebuild from one side point.
  await page.click("#resetBtn");
  await drag("Corner B", 26, -24);
  await drag("Point P", -18, 12);
  await page.click("#fromNBtn");
  await page.click("#hint");
  await shot("from-n");
  log("built from N:", await status());

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves; focus must stay on the moved corner.
  await handle("Corner C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await status());

  // Every button, then every checkbox in both directions.
  await page.click("#feetBtn");
  await page.click("#fromNBtn");
  await page.click("#names");
  await page.click("#names");
  await page.click("#helper");
  await page.click("#helper");
  await page.click("#resetBtn");
  log("hint disabled after Reset:", await page.locator("#hint").isDisabled());
  log("after Reset:", await status(), "| done =",
    await page.evaluate(() => document.getElementById("status").classList.contains("done")));
};
