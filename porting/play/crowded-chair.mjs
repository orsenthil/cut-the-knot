// Crowded Chair: two configurations of the chair, with every overlay shown.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs crowded-chair
export default async ({ page, first, log, shot, text }) => {
  const dragCorner = async (name, target) => {
    const box = await page.locator("#board").boundingBox();
    const dot = await page.locator(`[aria-label^="Corner ${name}."]`).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 440) * box.width,
      box.y + (target.y / 360) * box.height,
      { steps: 8 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#namesBox");
  await page.click("#statementBox");
  await page.click("#hintBox");

  // Configuration 1: a higher corner B tilts the triangle while every square
  // and the right-angle marks stay inside the board.
  await dragCorner("B", { x: 135, y: 110 });
  log("first chair:", await text("#status"));
  await shot("chair");

  // Configuration 2: slide C round its circle to the far arc; the crossings
  // move with it, but the circle through the square stays the same.
  await dragCorner("C", { x: 104, y: 303 });
  log("second chair:", await text("#status"));
  await shot("crowded");
  if (!first) return; // the dark run has taken the same two screenshots

  // Keyboard movement must keep the focus on the moved corner.
  const a = page.locator('[aria-label^="Corner A."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left corner A");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
