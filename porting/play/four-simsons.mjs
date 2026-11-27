// Four Simsons: two configurations of the diagram, with screenshots.
// This is a demonstration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-simsons
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

  // First configuration: move two corners, show the circles and Simson lines,
  // and open one line's triangle and perpendicular feet.
  await drag("A", 58, 32);
  await drag("C", -46, -34);
  await page.click("#circlesBox");
  await page.click("#simsonsBox");
  await page.locator("#board .simson").nth(0).click({ force: true });
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, move the other two corners, show every
  // checkbox and open a different Simson line.
  await page.click("#resetBtn");
  await drag("B", -52, 40);
  await drag("D", 44, -26);
  await page.click("#centersBox");
  await page.locator("#board .simson").nth(2).click({ force: true });
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved corner.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Keyboard access to a Simson line, then every control in both directions.
  await page.locator("#board .simson").nth(1).focus();
  await page.keyboard.press("Enter");
  log("after Enter on a line:", await text("#status"));
  await page.click("#centersBox");
  await page.click("#centersBox");
  await page.click("#circlesBox");
  await page.click("#circlesBox");
  await page.click("#simsonsBox");
  await page.click("#simsonsBox");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
