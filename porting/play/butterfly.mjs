// Butterfly: two drawings of the same theorem, one with a single circle and
// one with ten circles and a different permutation of the wings.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs butterfly
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle named ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const setN = (n) => page.evaluate((value) => {
    const el = document.getElementById("nRange");
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: one circle, moved spikes, the plain butterfly.
  await setN(1);
  await drag("Spike end A", 28, -22);
  await drag("Spike end C", -18, 16);
  await page.click("#checkBtn");
  log("one circle:", await text("#status"));
  await shot("one-circle");

  // Second configuration: all ten circles, a moved spike and a new pairing.
  await setN(10);
  await drag("Spike end C", -14, 8);
  await page.click("#permuteBtn");
  await page.click("#checkBtn");
  log("ten circles:", await text("#status"));
  await shot("ten-circles");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: arrows move the nexus and focus stays on it.
  await handle("Nexus M").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // The shortcut keys work outside the controls, then Reset restores order.
  await page.keyboard.press("p");
  await page.keyboard.press("c");
  log("after Permute and Check shortcuts:", await text("#status"));
  await page.keyboard.press("r");
  log("after Reset shortcut:", await text("#status"));
};
