// Harmonic Mean Sangaku: two configurations of the walls and ladders, then the
// keyboard, the check button and every toggle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs harmonic-mean-sangaku
export default async ({ page, first, log, shot, idle, text }) => {
  const prefixes = { A: "Foot A", B: "Foot B", D: "Top D", E: "Top E" };
  const handle = (name) => page.locator(`#board [aria-label^="${prefixes[name]} of the"]`).first();
  const drag = async (name, dx, dy) => {
    const node = handle(name);
    const box = await node.boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a taller right wall and the feet moved closer.
  await drag("D", 0, -48);
  await drag("A", 42, 0);
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Second configuration: start over, make the left wall taller and widen the gap.
  await page.click("#newBtn");
  await drag("E", 0, -56);
  await drag("B", 66, 0);
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots above

  await handle("E").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#checkBtn");
  log("after Check the identity:", await text("#status"));
  await shot("checked");

  await page.click("#namesBtn");
  log("names hidden:", await text("#namesBtn"));
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  log("guides hidden:", await text("#hintBtn"));
  await page.click("#hintBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
