// Menelaus: the opening Ceva picture, then the Menelaus transversal.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs menelaus
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  const opening = await text("#status");
  log("opening Ceva picture:", opening);
  if (!opening.includes("Ceva:") || !opening.includes("1.000"))
    throw new Error("the opening picture is not a Ceva configuration");
  await shot("ceva");

  await page.click("#menelausBtn");
  const switched = await text("#status");
  log("after switching to Menelaus:", switched);
  if (!switched.includes("Menelaus:") || !switched.includes("one line"))
    throw new Error("the switched picture is not a Menelaus transversal");
  await shot("menelaus");

  if (!first) return; // the dark run only needs the two screenshots above

  // Drag D along BC; the bright line must stay a single straight line.
  await drag("D", 14, -6);
  log("after dragging D:", await text("#status"));

  // Keyboard-only movement keeps the focus on E after each redraw.
  await handle("E").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("after keyboard moves:", await text("#status"));

  // Press every button in player order, and each keyboard shortcut both ways.
  await page.click("#cevaBtn");
  log("back to Ceva:", await text("#status"));
  await page.keyboard.press("m");
  log("after the m shortcut:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset view:", await text("#status"));
  await page.keyboard.press("c");
  log("after the c shortcut:", await text("#status"));
  await page.keyboard.press("r");
  log("after the r shortcut:", await text("#status"));
};
