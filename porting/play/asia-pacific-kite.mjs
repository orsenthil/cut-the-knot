// Asia Pacific Kite: two configurations of the line through D, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs asia-pacific-kite
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);

  /* Drag a named point to a target given in board (viewBox) units. */
  const dragTo = async (label, target) => {
    const box = await handle(label).boundingBox();
    const svg = await page.locator("#board").boundingBox();
    const vb = await page.evaluate(() => {
      const v = document.getElementById("board").viewBox.baseVal;
      return { x: v.x, y: v.y, width: v.width, height: v.height };
    });
    if (!box || !svg) throw new Error(`no handle or board for ${label}`);
    const sx = svg.width / vb.width, sy = svg.height / vb.height;
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const to = { x: svg.x + (target.x - vb.x) * sx, y: svg.y + (target.y - vb.y) * sy };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the page's exterior line, with the locus circle shown.
  await page.click("#hintBtn");
  await page.click("#premiseBtn");
  log("with hint on:", await text("#status"));
  await shot("exterior");

  // Second configuration: drag E along AB past B, so F falls on BC and M
  // moves to the upper arc of the same circle (angle AMC = 60 degrees).
  await page.click("#newBtn");
  await dragTo("Point E", { x: 250, y: 0 });
  log("after moving E past B:", await text("#status"));
  await shot("other-arc");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two keyboard moves keep focus on the board; the status follows the point.
  await handle("Point F").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  for (const id of ["#namesBtn", "#namesBtn", "#premiseBtn", "#premiseBtn",
    "#hintBtn", "#hintBtn", "#newBtn"]) {
    await page.click(id);
  }
  log("after resetting:", await text("#status"));
  await shot("reset");
};
