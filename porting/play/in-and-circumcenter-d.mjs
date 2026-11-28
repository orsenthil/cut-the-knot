// In And Circumcenter D: two triangle shapes, then every option in both
// directions and a keyboard-only move. Nothing is won or lost.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs in-and-circumcenter-d
export default async ({ page, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: swing A down and lift B, keeping a readable
  // triangle while changing both side differences and the two chords.
  await drag("A", 15, 15);
  await drag("B", -23, -69);
  log("first configuration:", await text("#status"));
  await shot("configuration-1");

  // Every checkbox of the applet's panel, both ways.
  for (const id of ["namesBox", "statementBox", "premiseBox", "hintBox"]) {
    await page.check(`#${id}`);
    log(`${id} on:`, await text("#status"));
  }
  await shot("options-on");
  for (const id of ["namesBox", "statementBox", "premiseBox", "hintBox"]) {
    await page.uncheck(`#${id}`);
  }
  log("options off:", await text("#status"));
  await shot("options-off");

  // Keyboard alone: after two arrows the focus must still be on C.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Second configuration: bring C back down towards the middle of the board.
  await drag("C", 25, 55);
  log("second configuration:", await text("#status"));
  await shot("configuration-2");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
