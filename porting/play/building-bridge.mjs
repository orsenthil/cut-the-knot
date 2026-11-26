// Building Bridge: explore two configurations and find the shortest bridge.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs building-bridge
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
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

  // Configuration 1: pull the towns asymmetrically, leaving the bridge put.
  await drag("Town A", -58, -22);
  await drag("Town B", 12, 8);
  log("after moving both towns:", await text("#status"));
  await shot("towns-moved");

  // Configuration 2: slide the bridge away, then let the page snap it to the
  // best crossing (the applet's "eyes open" state).
  await page.click("#newBtn");
  await drag("Bridge point C", -70, 0);
  log("bridge moved:", await text("#status"));
  await page.click("#snapBtn");
  log("after Snap to shortest:", await text("#status"));
  await shot("shortest-bridge");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard: two arrow keys keep focus on the bridge handle and update status.
  await handle("Bridge point C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#hintBtn");
  await page.click("#hintBtn");
  log("after hint toggles:", await text("#status"));
  await page.keyboard.press("s");
  log("after keyboard snap:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
