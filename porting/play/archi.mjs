// Archimedes' angle trisection: slide C into two solved configurations, then
// show the collapsed D=B branch and reset. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs archi
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board circle[role="button"][aria-label^="Point ${name}"]`);

  // Board units -> screen pixels, so the same scenario works at every width.
  const dragBoard = async (name, from, to) => {
    const box = await page.locator("#board").boundingBox();
    if (!box) throw new Error("no board");
    const at = (p) => ({ x: box.x + p.x * box.width / 400, y: box.y + p.y * box.height / 350 });
    const a = at(from), b = at(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: a right angle, with C at 2R cos(30°) = 121.2 left of O.
  await dragBoard("B", { x: 260, y: 228 }, { x: 200, y: 192 });
  await dragBoard("C", { x: 95, y: 262 }, { x: 78.8, y: 262 });
  log("90 degrees, trisected:", await text("#status"));
  await shot("trisected-90");

  // Second configuration: 120°, one third is 40°, C is 2R cos(40°) left of O.
  await dragBoard("B", { x: 200, y: 192 }, { x: 165, y: 201.4 });
  await dragBoard("C", { x: 78.8, y: 262 }, { x: 92.8, y: 262 });
  log("120 degrees, trisected:", await text("#status"));
  await shot("trisected-120");

  // Keyboard-only adjustments keep the focus on the handle that was moved.
  await handle("C").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await handle("B").focus();
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after keyboard:", await text("#status"), "| focus:", focused);

  // The other branch: CB = R collapses D onto B. D is on the circle but does
  // not trisect; C = O + 2R cos(120°) = 130.
  await dragBoard("B", { x: 165, y: 201 }, { x: 165, y: 201.4 });
  await dragBoard("C", { x: 90.8, y: 262 }, { x: 130, y: 262 });
  log("collapsed D = B:", await text("#status"));
  await shot("collapsed");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");

  if (!first) return; // the dark run only needs the screenshots above
};
