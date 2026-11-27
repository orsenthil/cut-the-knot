// Fermat Point: an illustration, so the two configurations are an acute
// triangle (with the three applet options on and D dragged onto F) and a
// triangle whose angle at C passes 120°, where C itself is the answer.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fermat-point

export default async ({ page, first, log, shot, text }) => {
  const handles = page.locator("#board .geom-handle");

  /** Drag one of the four handles to a point given in board (viewBox) units. */
  async function drag(index, at) {
    const box = await handles.nth(index).boundingBox();
    const to = await page.evaluate((p) => {
      const svg = document.getElementById("board");
      const m = svg.getScreenCTM();
      const q = svg.createSVGPoint();
      q.x = p.x; q.y = p.y;
      const s = q.matrixTransform(m);
      return { x: s.x, y: s.y };
    }, at);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }

  // Configuration 1: the applet's three checkboxes, plus the one-pixel case
  // where D sits on F and the long lines light up.
  await page.click("#names");
  await page.click("#hint");
  await page.click("#fermat");
  if (first) log("acute with all options:", await text("#status"));
  await shot("acute-options");

  const F = await page.evaluate(() => {
    const pts = [...document.querySelectorAll("#board .geom-handle")]
      .map((h) => ({ x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) }));
    return FermatPointCore.compute(pts[0], pts[1], pts[2], pts[3]).F;
  });
  await drag(3, F);
  if (first) log("with D on F:", await text("#status"));
  await shot("acute-near-D");

  // Keyboard alone: two arrow moves and the focus must stay on the board.
  await handles.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  if (first) log("keyboard focus after two moves:", focused);
  if (!/Corner A/.test(focused || "")) throw new Error("focus left the board after arrow keys");

  if (!first) return; // dark run has the two screenshots above

  // Configuration 2: bring C close to AB so its angle passes 120°.
  await page.click("#resetBtn");
  await drag(2, { x: 200, y: 158 });
  log("wide angle at C:", await text("#status"));
  await shot("wide-angle");
};
