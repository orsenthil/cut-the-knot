// Four Feet On Bisectors: two triangle shapes, with every overlay button pressed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-feet-on-bisectors
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a tall apex, with the proof's premise and hint shown.
  await drag("A", -40, -35);
  await drag("C", 34, -62);
  await page.click("#premiseBtn");
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("tall triangle, premise + statement + hint:", await text("#status"));
  await shot("tall");

  // Second configuration: a tilted triangle with names hidden.
  await page.click("#newBtn");
  await drag("A", 55, 14);
  await drag("B", 26, -34);
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#checkBtn");
  log("tilted triangle, names hidden:", await text("#status"));
  await shot("tilted");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle after the redraw.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every button again, both ways, in the order a player would.
  for (const id of ["statementBtn", "premiseBtn", "hintBtn", "namesBtn"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  await page.click("#checkBtn");
  log("after all toggles and another check:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
