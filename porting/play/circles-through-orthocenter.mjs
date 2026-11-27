// Circles Through Orthocenter: show the theorem on an acute and an obtuse triangle.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs circles-through-orthocenter
export default async ({ page, first, log, shot, text }) => {
  const dragCorner = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const dot = await page.locator(`[aria-label^="Corner ${name}."]`).boundingBox();
    if (!dot || !box) throw new Error(`no handle for corner ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 360) * box.width,
      box.y + (target.y / 240) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#namesBox");
  await page.click("#hintBox");

  // Configuration 1: a comfortable acute triangle with every overlay shown.
  await dragCorner("C", { x: 245, y: 70 });
  log("acute triangle:", await text("#status"));
  await shot("acute");
  if (!first) return; // the dark run has taken its screenshot of the same view

  // Configuration 2: slide C past the foot of the altitude, making an obtuse
  // triangle. The six crossings still lie on the dashed circle about O.
  await dragCorner("C", { x: 250, y: 110 });
  log("obtuse triangle:", await text("#status"));
  await shot("obtuse");

  // Arrow keys must move a corner and leave the focus on it.
  const a = page.locator('[aria-label^="Corner A."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left the corner");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#hintBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
