// In And Circumcenter: two configurations, then the toggles and keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs in-and-circumcenter
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull C to the side for a squat triangle.
  await drag("C", -42, -28);
  await page.click("#checkBtn");
  log("after dragging C and checking:", await text("#status"));
  await shot("skew");

  // Second configuration: the applet's own 30-degree equality case.
  await page.click("#newBtn");
  await page.click("#angleBtn");
  await page.click("#checkBtn");
  log("after Make C = 30 and checking:", await text("#status"));
  await shot("thirty-degrees");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement keeps focus on the handle; the construction follows.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // All four applet toggles, each pressed on and off, then every button once.
  for (const id of ["namesBtn", "statementBtn", "premiseBtn", "hintBtn"]) {
    await page.click(`#${id}`);
    log(`${id} on:`, await text("#status"));
    await page.click(`#${id}`);
  }
  await page.click("#hintBtn");
  await page.click("#premiseBtn");
  await page.click("#statementBtn");
  log("all clues on:", await text("#status"));
  await shot("clues");

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await page.click("#angleBtn");
  log("after another Make C = 30:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
