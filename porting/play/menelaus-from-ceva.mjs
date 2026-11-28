// Menelaus From Ceva: the opening transversal, then a moved configuration
// with the six proof lines switched on. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs menelaus-from-ceva
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  await idle("#board .geom-handle");
  const opening = await text("#status");
  log("opening configuration:", opening);
  if (!opening.includes("lie on one line") || !opening.includes("= 1.")) {
    throw new Error("the opening Menelaus product is not 1");
  }
  await shot("opening");

  // Configuration 2: switch on the extra Ceva lines and move E along AC.
  await page.locator("#addOns").check();
  await drag("E", -22, -12);
  const moved = await text("#status");
  log("after moving E with add-ons on:", moved);
  if (!moved.includes("lie on one line") || !moved.includes("= 1.")) {
    throw new Error("the moved points are not collinear");
  }
  const crossings = await page.locator("#board .proof-label:not([style*='display: none'])").count();
  log("visible proof crossings:", crossings);
  if (crossings !== 3) throw new Error("expected X, Y and Z to be drawn");
  await shot("add-ons");

  if (!first) return; // the dark run only needed the two screenshots above

  // Keyboard-only movement: focus must stay on the dot after each redraw.
  await handle("D").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("after keyboard moves:", await text("#status"));

  // The checkbox in both directions, Reset by button and by keyboard.
  await page.locator("#addOns").uncheck();
  log("add-ons off:", await page.locator("#addOns").isChecked());
  await page.locator("#addOns").check();
  log("add-ons on:", await page.locator("#addOns").isChecked());
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  await page.keyboard.press("r");
  log("after the r shortcut:", await text("#status"));
};
