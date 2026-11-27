// de Villiers: two configurations of the similar triangles on a quadrilateral.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs de-villiers
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${/^[ABCD]$/.test(name) ? "Corner" : "Apex"} ${name}"]`);
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
  log("start:", await text("#status"));

  // First configuration: reshape the quadrilateral, show the names and outline.
  await drag("B", 30, -34);
  await drag("D", -38, 26);
  await page.click("#names");
  await page.click("#para");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, change the common triangle shape at P,
  // then show the equal angle marks.
  await page.click("#newBtn");
  await drag("P", 40, -24);
  await drag("A", -26, 18);
  await page.click("#angles");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved handle.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  await page.click("#names");
  await page.click("#para");
  await page.click("#para");
  await page.click("#angles");
  await page.click("#angles");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
