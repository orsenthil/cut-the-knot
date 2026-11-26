// Besteman 2: two configurations of the illustration, plus every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs besteman-2
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
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
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: move A, keeping the short radius AB small.
  await drag("A", -18, 26);
  log("after dragging A:", await text("#status"));
  await shot("configuration-a");

  // Second configuration: five parts, a shorter AB so all five dots and C
  // stay on the phone screen, and the equal-angle hint.
  await page.click("#moreBtn");
  await page.click("#moreBtn");
  await drag("B", -30, -20);
  await page.click("#hintBtn");
  log("after five parts and a shorter AB:", await text("#status"));
  await shot("configuration-b");

  if (!first) return; // the dark run only needs the two screenshots above

  // Check the claims (the illustration's way of finishing), then the toggles.
  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await page.click("#namesBtn");
  log("names hidden:", await page.locator("#namesBtn").getAttribute("aria-pressed"));
  await page.click("#namesBtn");
  await page.click("#hintBtn");

  // Two moves with the keyboard alone; focus must stay on the handle.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // The spin buttons and the number edit, including out-of-range values.
  await page.click("#lessBtn");
  log("after one fewer:", await text("#status"));
  await page.fill("#nInput", "99");
  await page.locator("#nInput").press("Tab");
  log("after 99 (clamped):", await page.locator("#nInput").inputValue());
  await page.fill("#nInput", "0");
  await page.locator("#nInput").press("Tab");
  log("after 0 (clamped):", await page.locator("#nInput").inputValue());
  await page.fill("#nInput", "5");
  await page.locator("#nInput").press("Tab");
  await page.click("#checkBtn");

  await page.keyboard.press("r");
  log("after Reset key:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset button:", await text("#status"));
};
