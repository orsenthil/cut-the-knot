// Max Common Chord 2: two configurations of the chord through P.  This is a
// demonstration, so there is no win or loss to play for.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs max-common-chord-2
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: turn the chord with the circles fixed, and show the
  // angle hints.  S should still be reported on the third circle.
  await drag("A", -46, 22);
  await drag("B", 34, -30);
  await page.click("#show-hint");
  log("first configuration:", await text("#status"));
  await shot("first");

  // Second configuration: reset, then place the diameter chord and show the
  // names.  The status should now say that AQ is a diameter.
  await page.click("#resetBtn");
  await page.click("#optimalBtn");
  await page.click("#show-names");
  log("diameter configuration:", await text("#status"));
  await shot("second");

  if (!first) return; // dark run only needs the two screenshots above

  // Two keyboard-only moves: focus must stay on the moved dot.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard moves:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click('input[name="adjust"][value="chord"]');
  await drag("B", -18, 16); // glide the end along the drawn circle
  log("chord mode:", await text("#status"));
  await page.click('input[name="adjust"][value="circles"]');
  await drag("A", 20, -14); // rebuild the circle instead
  log("circles mode:", await text("#status"));
  await page.click("#show-names");
  await page.click("#show-names");
  await page.click("#show-hint");
  await page.click("#show-hint");
  await page.click("#optimalBtn");
  log("diameter chord again:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
