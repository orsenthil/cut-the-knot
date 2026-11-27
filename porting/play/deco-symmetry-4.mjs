// Deco Symmetry 4: make two configurations, turn the pieces, then switch the
// cuts off by moving the top corner beyond the base.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs deco-symmetry-4
export default async ({ page, first, log, shot, idle, text }) => {
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

  // First configuration: widen the base and move A across it. A' still sits
  // on the base, so both cuts are shown and Move them is available.
  await drag("B", -24, 0);
  await drag("C", 24, 0);
  await drag("A", 44, -18);
  log("first configuration:", await text("#status"));
  await shot("two-cuts");

  // The applet's thread: 50 steps of a half turn for the two end pieces.
  await page.click("#moveBtn");
  await page.waitForFunction(() => document.querySelector("#moveBtn")?.textContent === "Moved", null, { timeout: 5000 });
  log("after Move them:", await text("#status"));
  await shot("moved");

  if (!first) return; // the dark run only needs the two configurations above

  await page.click("#resetBtn");

  // Second configuration: slide A past B, where the applet disables the move.
  await drag("A", -150, 20);
  const disabled = await page.locator("#moveBtn").isDisabled();
  log("second configuration:", await text("#status"), "| Move them disabled:", disabled);
  await shot("outside");

  // Every option in both directions.
  await page.check("#namesBox");
  await page.check("#hintBox");
  log("options on:", await text("#status"));
  await shot("options-on");
  await page.uncheck("#namesBox");
  await page.uncheck("#hintBox");
  log("options off:", await text("#status"));
  await shot("options-off");

  // Keyboard only: focus must stay on the handle after two arrow keys.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
