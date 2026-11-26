// Altitude Mirror: drag A and P into two configurations and look at the diagram.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs altitude-mirror
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

  // First configuration: pull A sideways so the triangle stays acute and the
  // angle marks would be equal; slide P towards H.
  await drag("A", 80, -24);
  await drag("P", 0, 20);
  log("first configuration:", await text("#status"));
  await shot("acute");

  // Second configuration: pull C close to B, pushing the altitude foot H
  // outside BC. The status line says the page's angle claim no longer applies.
  await drag("C", -90, 12);
  log("second configuration:", await text("#status"));
  await shot("outside");

  if (!first) return; // the dark run only needs the two screenshots

  // All three options, in both directions.
  for (const id of ["namesBox", "statementBox", "hintBox"]) {
    await page.check(`#${id}`);
    log(`${id} on:`, (await text("#board")).includes("F") ? "helper labels shown" : "labels updated");
  }
  await shot("options-on");
  for (const id of ["namesBox", "statementBox", "hintBox"]) await page.uncheck(`#${id}`);
  log("options off:", await text("#status"));
  await shot("options-off");

  // Keyboard only: focus must stay on the dragged handle after two arrows.
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
