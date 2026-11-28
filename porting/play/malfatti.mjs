// Malfatti: explore two triangle shapes and every layer of Steiner's construction.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs malfatti
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

  // First configuration: a skewed triangle with the auxiliary incircles,
  // second tangents and point names visible.
  await drag("C", -22, 18);
  await page.click("#incircles");
  await page.click("#secondTangents");
  await page.click("#names");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, pull B in, and show the angle bisectors
  // instead. The status still reports the three radii.
  await page.click("#resetBtn");
  await drag("B", -18, -12);
  await page.click("#incircles");
  await page.click("#secondTangents");
  await page.click("#bisectors");
  await page.click("#names");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, both ways.
  await page.click("#bisectors");
  await page.click("#bisectors");
  await page.click("#incircles");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
