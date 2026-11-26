// Archimedes Triangle: drag A and B to two configurations, with the overlays on.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs archimedes-triangle
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const dot = await handle(name).boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 320) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  for (const id of ["#namesBox", "#lemmaBox", "#theoremBox", "#fillBox"]) await page.click(id);
  log("with the lemma, theorem and fills:", await text("#status"));

  // Configuration 1: a wide, almost symmetric Archimedes triangle.
  await drag("A", { x: 290, y: 126 });
  await drag("B", { x: 120, y: 133 });
  log("wide triangle:", await text("#status"));
  await shot("wide");

  // Configuration 2: both points on the right, a steep triangle.
  await page.click("#newBtn");
  await drag("A", { x: 370, y: 40 });
  await drag("B", { x: 240, y: 153 });
  log("steep triangle:", await text("#status"));
  await shot("steep");

  if (!first) return; // the dark run has taken both screenshots already

  // Arrow keys move a handle without losing keyboard focus.
  const a = handle("A");
  await a.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  if (!focused.startsWith("Point A")) throw new Error("keyboard focus left point A");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#lemmaBox", "#theoremBox", "#fillBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
