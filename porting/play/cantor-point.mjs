// Cantor Point: two configurations of the illustration, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cantor-point
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const toggle = (id) => page.click(`#${id}`);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the theorem itself, Cantor lines and nine-point circle.
  await toggle("cantorBtn");
  await toggle("nineBtn");
  await drag("A", 46, -18);
  log("after dragging A:", await text("#status"));
  await shot("cantor");

  if (first) {
    // Keyboard moves keep focus on the handle while the picture follows.
    await corner("C").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("status after keyboard:", await text("#status"));

    // Press every button in the order a player would, in both directions.
    await page.click("#checkBtn");
    log("after Check the claims:", await text("#status"),
        "class:", await page.getAttribute("#status", "class"));
    for (const id of ["tangentialBtn", "circumcircleBtn", "circumcenterBtn", "circumradiiBtn"]) {
      await toggle(id);
      await toggle(id);
    }
    await toggle("cantorBtn");
    log("Cantor lines off:", await text("#status"));
    await toggle("cantorBtn");
    await page.click("#newBtn");
    log("after Reset:", await text("#status"));
  }

  // Second configuration: all of the applet's six constructions, with B moved.
  await page.click("#newBtn");
  for (const id of ["cantorBtn", "nineBtn", "tangentialBtn", "circumcircleBtn", "circumcenterBtn", "circumradiiBtn"]) {
    if ((await page.getAttribute(`#${id}`, "aria-pressed")) !== "true") await toggle(id);
  }
  await drag("B", -40, 16);
  log("with every part shown, after dragging B:", await text("#status"));
  await shot("full");
};
