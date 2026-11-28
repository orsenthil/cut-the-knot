// In And Circumcenter B: drag to a 30-degree triangle, then to another angle.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs in-and-circumcenter-b
export default async ({ page, first, log, shot, text }) => {
  const dragCorner = async (name, target) => {
    const box = await page.locator("#board").boundingBox();
    const dot = await page.locator(`[aria-label^="Corner ${name}."]`).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 360) * box.width,
      box.y + (target.y / 360) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#statementBox");
  await page.click("#premiseBox");
  await page.click("#hintBox");

  // Configuration 1: C placed so angle ACB is 30 degrees; DE = IO as well
  // as DE perpendicular to IO. Every overlay is on.
  await dragCorner("C", { x: 34, y: 42 });
  log("30 degrees:", await text("#status"));
  await shot("thirty");
  if (!first) return; // the dark run has taken the same screenshot

  // Configuration 2: a different angle, where the right angle survives but
  // the two lengths differ.
  await dragCorner("C", { x: 150, y: 118 });
  log("another angle:", await text("#status"));
  await shot("other");

  // Keyboard play keeps the focus on the moved corner.
  const a = page.locator('[aria-label^="Corner A."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left the corner");

  // Press everything both ways, in the order a player would.
  for (const id of ["namesBox", "statementBox", "premiseBox", "hintBox"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
