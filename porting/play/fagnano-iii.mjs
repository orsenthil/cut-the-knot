// Fagnano III: two configurations of the rolled triangle, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fagnano-iii
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: lift A so the triangle is clearly acute, slide P
  // towards the foot of the altitude, and show the construction.
  await drag("A", 8, -36);
  await drag("P", 0, 18);
  await page.check("#constructionBox");
  await page.check("#mapBox");
  await page.check("#namesBox");
  log("first configuration:", await text("#status"));
  await shot("acute");

  // Second configuration: pull C across B to make the triangle obtuse. The
  // status line states plainly that the page's claim no longer applies.
  await drag("C", -150, 10);
  log("second configuration:", await text("#status"));
  await shot("obtuse");

  if (!first) return; // the dark run only needs the two screenshots above

  // Every option in both directions, and the extra triangles at full extent.
  for (const id of ["altitudesBox", "moreBox"]) await page.check(`#${id}`);
  log("all options on, status:", await text("#status"));
  await shot("all-options");
  for (const id of ["altitudesBox", "moreBox", "constructionBox", "mapBox", "namesBox"]) {
    await page.uncheck(`#${id}`);
  }
  log("all options off, status:", await text("#status"));
  await shot("options-off");

  // Keyboard only: focus must remain on the moved handle after two arrows.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
