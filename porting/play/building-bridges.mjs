// Building Bridges: two river layouts, each checked, in light and dark.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs building-bridges
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (prefix) => page.locator(`#board [aria-label^="${prefix}"]`);
  const drag = async (prefix, dx, dy) => {
    const box = await handle(prefix).boundingBox();
    if (!box) throw new Error(`no handle for ${prefix}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move town A and slide the first bridge toward the
  // straight dashed line, then check the claim.
  await drag("Town A", -14, -12);
  await drag("Bridge point C on the first river", 22, 0);
  await page.click("#checkBtn");
  log("after the first check:", await text("#status"));
  await shot("first-rivers");

  // Second configuration: a fresh layout, move town B and the other bridge.
  await page.click("#newBtn");
  await drag("Town B", -22, -10);
  await drag("Bridge point C double prime", -45, 0);
  await page.click("#checkBtn");
  log("after the second check:", await text("#status"));
  await shot("second-rivers");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard play keeps focus on the moved handle, and every control works.
  await handle("Bridge point C on the first river").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("focus after two arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  await page.click("#labelsBtn");
  log("names hidden:", await page.getAttribute("#labelsBtn", "aria-pressed"));
  await page.click("#labelsBtn");
  await page.click("#checkBtn");
  log("after rechecking:", await text("#status"));
  await page.click("#newBtn");
  log("after New layout:", await text("#status"));
  await shot("reset");
};
