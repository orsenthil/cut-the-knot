// Medial Nagel: a demonstration, so two configurations instead of a win and a
// loss. The claim is checked in both.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs medial-nagel
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: check the applet's starting triangle as it opens.
  await page.click("#checkBtn");
  log("first triangle:", await text("#status"));
  await shot("first");

  // Second configuration: reset, pull C down and left into an obtuse triangle.
  await page.click("#newBtn");
  await drag("C", -100, 90);
  await page.click("#checkBtn");
  log("obtuse triangle:", await text("#status"));
  await shot("obtuse");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the drawing follows.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every switch in both directions and check the claim again.
  for (const id of ["#hintBtn", "#extraBtn", "#incircleBtn", "#namesBtn"]) {
    await page.click(id);
    log(`${id} off/on:`, await page.locator(id).getAttribute("aria-pressed"));
  }
  for (const id of ["#namesBtn", "#incircleBtn", "#extraBtn", "#hintBtn"]) {
    await page.click(id);
    log(`${id} back:`, await page.locator(id).getAttribute("aria-pressed"));
  }
  await page.click("#checkBtn");
  log("after all toggles and Check:", await text("#status"));
  await corner("A").focus();
  await page.keyboard.press("r");
  log("after the r shortcut:", await text("#status"));
  log("focus after reset:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  await shot("reset");
};
