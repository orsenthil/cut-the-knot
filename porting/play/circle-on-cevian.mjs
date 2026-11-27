// Circle On Cevian: show two configurations of the illustration and press every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-on-cevian
export default async ({ page, first, log, shot, idle, text }) => {
  const center = async (label) => {
    const box = await page.locator(`#board [aria-label^="${label}"]`).boundingBox();
    if (!box) throw new Error(`no handle labelled ${label}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const drag = async (label, dx, dy) => {
    const { x, y } = await center(label);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: two cevians; pull corner A and the dot on its side.
  await page.click("#twoBtn");
  await drag("Corner A", 72, -38);
  await drag("Point on the side opposite A", -22, 14);
  log("after two-cevian drags:", await text("#status"));
  await shot("two-cevians");

  // Second configuration: reset, all three cevians, an obtuse triangle.
  await page.click("#newBtn");
  await page.click("#threeBtn");
  await drag("Corner C", -68, 42);
  await drag("Point on the side opposite B", 20, -24);
  log("after three-cevian drags:", await text("#status"));
  await shot("three-cevians");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the dragged dot; the circles follow.
  const foot = page.locator('#board [aria-label^="Point on the side opposite A"]');
  await foot.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press the controls in the order a player would, in both directions.
  await page.click("#oneBtn");
  log("one cevian:", await text("#status"));
  await page.click("#twoBtn");
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#threeBtn"); // the applet disables Hint here
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  log("all three again:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  await page.keyboard.press("r");
  await page.keyboard.press("2");
  log("after keyboard 2:", await text("#status"));
};
