// Griffiths: a drawing, not a game. Show two configurations — the two pedal
// circles on their line through O with perpendiculars switched on, then a new
// triangle after Reset with the circles still shown and Q slid along the line.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs griffiths
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy, steps = 12) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps });
    await page.mouse.up();
    await idle();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: both old "Show" checkboxes on; slide the two line points.
  await page.check("#perps");
  await page.check("#circles");
  await drag("P", 26, -14);
  await drag("Q", 18, 22); // slide it away from O, not towards P
  log("three circles:", await text("#status"));
  await shot("three-circles");

  // Configuration 2: Reset keeps the checkboxes; move a triangle corner (O
  // follows it and carries Q) and then slide Q again.
  await page.click("#resetBtn");
  await drag("A", -20, 18);
  await drag("Q", 24, -10);
  log("triangle moved:", await text("#status"));
  await shot("moved-triangle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: two arrow presses, with focus still on the point.
  await handle("P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrows:", focused.slice(0, 60));
  log("after keyboard:", await text("#status"));

  // Every button and both options in both directions.
  await page.uncheck("#circles");
  await page.uncheck("#perps");
  log("both options off:", await text("#status"));
  await page.check("#perps");
  await page.check("#circles");
  await handle("Q").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  log("after second keyboard move:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
