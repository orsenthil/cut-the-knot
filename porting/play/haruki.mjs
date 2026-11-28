// Haruki: two configurations of the same droodle, with the equal lengths and
// then the angle hint shown. There is no win or loss in this illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs haruki
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle named ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: the statement turned on, with P and D moved round their
  // circle so the two green lengths are visibly equal in a new figure.
  await page.click("#statement");
  await drag("P", 34, -20);
  await drag("D", -12, 22);
  log("configuration 1:", await text("#status"));
  await shot("equal-lengths");

  // Configuration 2: reset the points, show the angle hint, make the chords
  // scalene and slide P to the other side.
  await page.click("#resetBtn");
  await page.click("#statement"); // off
  await page.click("#hint");      // on
  await drag("A", 22, 12);
  await drag("C", -14, -24);
  await drag("P", -28, 10);
  log("configuration 2:", await text("#status"));
  await shot("angle-hint");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard alone: two arrow keys keep focus on the same handle.
  await handle("A").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
