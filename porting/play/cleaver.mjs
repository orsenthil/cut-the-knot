// The Cleaver: the opening triangle with every box ticked, then C pulled to
// the other side so D jumps to BC, then the triangle dragged.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cleaver
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (n) => page.locator(`#board [aria-label^="Corner ${n}"]`);
  const drag = async (loc, dx, dy) => {
    const box = await loc.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await page.check("#namesBox");
  await page.check("#premiseBox");
  await page.check("#statementBox");
  await shot("all-shown");

  await drag(handle("C"), -90, 10);
  log("C moved left:", await text("#status"));
  await shot("d-on-bc");
  if (!first) return;

  await handle("A").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  await drag(page.locator("#board .tri-body"), 15, -10);
  log("dragged:", await text("#status"));
  await page.uncheck("#premiseBox");
  await page.uncheck("#statementBox");
  await page.uncheck("#namesBox");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
