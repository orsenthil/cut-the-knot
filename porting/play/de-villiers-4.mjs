// de Villiers 4: two configurations of the illustration.
// There is no win or loss: the picture either shows the collinear claim or it
// does not.  Run with: NODE_PATH=$(npm root -g) node porting/play.mjs de-villiers-4
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Corner ${name}"], #board [aria-label^="Triangle tip ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };
  const setBox = async (id, on) => {
    const box = page.locator(`#${id}`);
    if (await box.isDisabled()) {
      log(`${id} is disabled here, left as it was`);
      return;
    }
    if (await box.isChecked() !== on) await box.click();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: an ordinary quadrilateral with the tip angles shown.
  await drag("C", 38, 24);
  await drag("P", -26, 30);
  await page.click("#names");
  await page.click("#angles");
  log("first shape:", await text("#status"));
  await shot("first-shape");

  if (first) {
    // Keyboard-only moves: focus must remain on the same tip handle.
    await handle("P").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("status after keyboard:", await text("#status"));

    // Press every control in a player's order, in both directions.
    await page.click("#resetBtn");
    await page.click("#alignBtn");
    await setBox("names", false);
    await setBox("names", true);
    await setBox("hint", true);
    log("hint on:", await text("#status"));
    await setBox("hint", false);
    await setBox("angles", true);
    await setBox("angles", false);
    await page.click("#resetBtn");
    await page.click("#alignBtn");
    await setBox("hint", true);
    log("claim again:", await text("#status"));
  }

  // Configuration 2: the page's theorem configuration, with the line and hint.
  await page.click("#resetBtn");
  await page.click("#alignBtn");
  await setBox("names", true);
  await setBox("angles", false);
  await setBox("hint", true);
  log("aligned:", await text("#status"));
  await shot("claim");
};
