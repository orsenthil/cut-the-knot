// Eves Extension: two configurations of the same construction, plus a check
// that the keyboard keeps its place and every option reaches the applet's
// limits. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs eves-extension
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board .geom-handle[aria-label^="${label}"]`);
  async function drag(label, dx, dy) {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error("no handle for " + label);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  await idle("#board .geom-handle");
  log("five sides:", await text("#status"));
  await shot("start");

  // First configuration: an even polygon with a start far from a tangency
  // point. The second loop must still repeat the first.
  await page.click("#plusBtn");
  await drag("Tangency point 3 ", 34, -28);
  await drag("Red start point.", -42, 36);
  log("six sides, dragged:", await text("#status"));
  await shot("even");

  // Second configuration: an odd polygon, first away from and then at a
  // tangency point; only the latter closes the two loops.
  await page.click("#minusBtn");
  await drag("Tangency point 2 ", -26, 20);
  log("five sides, away from tangency:", await text("#status"));
  await shot("odd-open");
  await page.click("#tangencyBtn");
  log("five sides, at tangency:", await text("#status"));
  await shot("odd-closed");

  if (!first) return; // the dark run only needs the screenshots above

  // Two keyboard moves must leave the focus on the same handle.
  await handle("Red start point.").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in a player's order, and push the count both ways.
  await page.click("#minusBtn");
  await page.click("#minusBtn");
  await page.click("#plusBtn");
  await page.click("#tangencyBtn");
  await page.click("#resetBtn");
  await page.fill("#nInput", "2");
  await page.locator("#nInput").press("Tab");
  log("below the minimum:", await text("#status"));
  await page.fill("#nInput", "25");
  await page.locator("#nInput").press("Tab");
  log("above the maximum:", await text("#status"));
  await shot("max-n");
  log("largest N is:", await page.inputValue("#nInput"));
};
