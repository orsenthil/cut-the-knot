// Deco Symmetry: two configurations, each finished with Move them.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs deco-symmetry
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const assemble = async () => {
    await page.click("#moveBtn");
    await idle(() => document.querySelector("#status")?.classList.contains("done"));
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: the opening (acute) triangle with the three-piece
  // circumcentre option, assembled with a rotation and a slide.
  await page.check("#acuteBox");
  log("acute:", await text("#status"));
  await shot("acute");
  await assemble();
  log("acute assembled:", await text("#status"));
  await shot("acute-done");

  // Second configuration: reset, pull M right until the triangle is obtuse,
  // and show the names and right-angle/tick-mark hints on the four pieces.
  await page.click("#resetBtn");
  await drag("M", 120, 0);
  await page.check("#namesBox");
  await page.check("#hintBox");
  log("obtuse:", await text("#status"));
  log("acute box disabled:", await page.locator("#acuteBox").isDisabled());
  await shot("obtuse");

  if (!first) return; // dark run only needs the two configurations above

  await assemble();
  log("obtuse assembled:", await text("#status"));
  await shot("obtuse-done");

  // Keyboard only: two arrow presses on a corner, then check focus survives.
  await handle("K").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrows:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("after keyboard:", await text("#status"));
  await shot("keyboard");

  // Every option both ways, then a final Reset.
  await page.uncheck("#namesBox");
  await page.uncheck("#hintBox");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
