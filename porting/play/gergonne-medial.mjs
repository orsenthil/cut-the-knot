// Gergonne Medial: a demonstration, so two configurations instead of a win
// and a loss. The claim is checked in both.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gergonne-medial
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

  // First configuration: pull A inward, making a compact acute triangle.
  await drag("A", 95, -40);
  await page.click("#checkBtn");
  log("compact triangle:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, then pull C down and left into an obtuse triangle.
  await page.click("#newBtn");
  await drag("C", -95, 90);
  await page.click("#checkBtn");
  log("obtuse triangle:", await text("#status"));
  await shot("obtuse");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the picture follows.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#hintBtn");
  log("hint on:", await text("#status"));
  await page.click("#namesBtn");
  log("names off:", await text("#status"));
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("after toggles back and Check:", await text("#status"));
  await shot("checked");
};
