// Broken Chord Paper Folding: two triangle configurations and every switch.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs broken-chord-paper-folding
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
      box.x + (target.x / 600) * box.width,
      box.y + (target.y / 450) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#hintBox");
  await page.click("#linesBox");
  await page.click("#anglesBox");
  await page.click("#extraBox");
  log("with the fold and all marks:", await text("#status"));
  await shot("fold");

  // Configuration 2: BC is now the longer side, so M falls on BC and the
  // reflected point is A rather than B.
  await drag("A", { x: 405, y: 359 });
  await drag("B", { x: 233, y: 298 });
  await drag("C", { x: 439, y: 301 });
  log("BC longer, second fold:", await text("#status"));
  await shot("swapped");

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
  for (const id of ["#namesBox", "#hintBox", "#linesBox", "#anglesBox", "#extraBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
