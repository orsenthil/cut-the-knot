// Area Of Triangle: drag the top corner past either end of the base, then
// back inside, and look at the signed rectangles in both themes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs area-of-triangle
export default async ({ page, first, log, shot, text }) => {
  const dragTo = async (name, x, y) => {
    const handle = page.locator(`#board circle[aria-label^="Corner ${name}."]`);
    const h = await handle.boundingBox();
    const b = await page.locator("#board").boundingBox();
    if (!h || !b) throw new Error(`cannot find corner ${name} or the board`);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + (x / 400) * b.width, b.y + (y / 300) * b.height, { steps: 10 });
    await page.mouse.up();
  };

  log("opening:", await text("#status"));
  await page.click("#colorsBox");
  await page.click("#namesBox");

  // H lands to the left of A, so AHCP is the rectangle with a minus sign.
  await dragTo("C", 55, 70);
  log("H beyond A:", await text("#status"));
  await shot("outside-left");
  if (!first) return;

  // H lands to the right of B, so HBQC is the negative one.
  await dragTo("C", 345, 85);
  log("H beyond B:", await text("#status"));
  await shot("outside-right");

  await dragTo("C", 205, 60);
  log("H inside:", await text("#status"));
  await page.click("#triangleBox");
  await shot("inside");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
