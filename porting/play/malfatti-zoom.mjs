// Malfatti Zoom: two triangle configurations, with every panel option pressed.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs malfatti-zoom
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Vertex ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error("no handle for " + name);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: show every layer and pull one corner down. Both E
  // points now land on the same side, the case Hart treats first.
  for (const id of ["#namesChk", "#bisectorsChk", "#incirclesChk", "#tangentsChk"]) {
    await page.click(id);
  }
  await drag("A\u2082", -48, 20);
  log("first shape:", await text("#status"));
  await shot("first");

  if (!first) return; // the dark run only needs the screenshots above

  // Second configuration: reset, make a skewed triangle and zoom right in.
  await page.click("#resetBtn");
  await drag("A\u2083", 46, -32);
  await drag("A\u2081", -30, -18);
  for (const level of ["2", "4", "6", "8"]) {
    await page.click(`[data-zoom="${level}"]`);
  }
  log("second shape:", await text("#status"));
  await shot("second");

  // Two keyboard-only moves: focus must stay on the moved vertex.
  await handle("A\u2081").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click('[data-zoom="1"]');
  for (const id of ["#tangentsChk", "#incirclesChk", "#bisectorsChk", "#namesChk"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
