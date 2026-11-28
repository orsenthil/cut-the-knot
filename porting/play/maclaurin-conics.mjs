// Mac Laurin Conics: explore two configurations of the construction.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs maclaurin-conics
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 16 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: U, V and W are off their line, so A draws a conic.
  await drag("Point B", -22, -34);
  await drag("Point B", -18, -28);
  await drag("Point B", 26, 40);
  await drag("Point B", 22, 34);
  await drag("Point B", -12, -18);
  await page.click("#namesBtn");
  await page.click("#extraBtn");
  await page.click("#checkBtn");
  log("conic case:", await text("#status"));
  await shot("conic");

  // Second configuration: put U, V and W on a line and trace the degenerate path.
  await page.click("#lineBtn");
  await drag("Point B", -24, -38);
  await drag("Point B", -20, -32);
  await drag("Point B", -16, -26);
  await drag("Point B", 36, 56);
  await drag("Point B", 20, 32);
  await page.click("#namesBtn");
  await page.click("#extraBtn");
  await page.click("#checkBtn");
  log("straight-line case:", await text("#status"));
  await shot("line");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved glider.
  await handle("Point B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in the order a player would, in both directions.
  await page.click("#checkBtn");
  await page.click("#extraBtn");
  await page.click("#extraBtn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#lineBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
