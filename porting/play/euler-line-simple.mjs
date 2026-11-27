// Euler Line Simple: two configurations — C's parallelogram, then an obtuse
// triangle with medians, bisectors and altitudes shown.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs euler-line-simple
export default async ({ page, first, log, shot, text }) => {
  const dragCorner = async (name, target) => {
    const box = await page.locator("#board").boundingBox();
    const dot = await page.locator(`[aria-label^="Corner ${name}."]`).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 360) * box.width,
      box.y + (target.y / 240) * box.height,
      { steps: 8 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#hintBox");
  await page.click("#selectC");
  await dragCorner("C", { x: 250, y: 90 });
  log("with C chosen:", await text("#status"));
  await shot("parallelogram");
  if (!first) return; // the dark run has taken its screenshot of the same view

  // Keyboard movement must keep the focus on the moved corner.
  const a = page.locator('[aria-label^="Corner A."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left corner A");

  await page.click("#selectA");
  log("after Highlight A:", await text("#status"));
  await page.click("#selectB");
  log("after Highlight B:", await text("#status"));
  await page.click("#mediansBox");
  await page.click("#bisectorsBox");
  await page.click("#namesBox");
  await page.click("#namesBox"); // both directions

  // Configuration 2: C moves close to AB, making an obtuse triangle.
  await dragCorner("C", { x: 165, y: 140 });
  log("obtuse triangle:", await text("#status"));
  await shot("obtuse");

  await page.click("#altitudesBox");
  log("with altitudes:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
