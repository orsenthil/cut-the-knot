// Inscriptible Quadri: show the circumscribed figure, then drag a dot until the
// circle falls outside it. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs inscriptible-quadri
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const dot = await handle(name).boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 250) * box.height,
      { steps: 12 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  for (const id of ["#namesBox", "#tangencyBox", "#tangentsBox", "#sidesBox"]) {
    await page.click(id);
  }
  log("with every overlay on:", await text("#status"));

  // Configuration 1: a proper circumscribed quadrilateral. Move the circle
  // and put P in the lower half so all four gaps round the circle are < PI.
  await drag("Centre of the circle", { x: 170, y: 125 });
  await drag("Dot P", { x: 175, y: 45 });
  log("circle inside the figure:", await text("#status"));
  await shot("inside");

  // Configuration 2: pull P into the upper half. The circle is now outside
  // ABCD and a different pair of side lengths matches.
  await drag("Dot P", { x: 110, y: 105 });
  log("circle outside the figure:", await text("#status"));
  await shot("outside");

  if (!first) return; // the dark run has taken both screenshots already

  // Arrow keys move a handle without losing keyboard focus.
  const p = handle("Dot P");
  await p.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  if (!focused.startsWith("Dot P")) throw new Error("keyboard focus left dot P");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#tangencyBox", "#tangentsBox", "#sidesBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await drag("Dot M", { x: 300, y: 150 });
  await drag("Dot Q", { x: 90, y: 190 });
  await drag("Dot N", { x: 120, y: 60 });
  await drag("Centre of the circle", { x: 140, y: 140 });
  log("after dragging all handles:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
