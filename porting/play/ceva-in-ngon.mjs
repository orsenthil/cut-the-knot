// Cross Points in a Polygon: drag P and a corner, then try the largest n.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ceva-in-ngon
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (prefix) => page.locator(`#board [aria-label^="${prefix}"]`);
  const drag = async (locator, dx, dy) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("no handle to drag");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: five sides, P pulled left, one corner moved.
  await drag(handle("Point P"), -48, -24);
  await drag(handle("Vertex A0"), 22, 18);
  log("five sides:", await text("#status"));
  await shot("five-sides");

  // Second configuration: the largest option, n = 21, and P far to the right.
  for (let i = 0; i < 8; i++) await page.click("#nPlus");
  log("n after eight presses:", await text("#nOut"));
  await drag(handle("Point P"), 86, 44);
  log("21 sides:", await text("#status"));
  await shot("21-sides");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle; the picture follows.
  await handle("Vertex A0").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every button, then walk the spinner down to its minimum and back.
  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));
  await page.click("#newBtn");
  log("after New picture:", await text("#status"));
  for (let i = 0; i < 9; i++) await page.click("#nMinus");
  log("n at the minimum:", await text("#nOut"));
  log("minus disabled at the minimum:", await page.locator("#nMinus").isDisabled());
  for (let i = 0; i < 9; i++) await page.click("#nPlus");
  log("n back at the maximum:", await text("#nOut"));
  log("plus disabled at the maximum:", await page.locator("#nPlus").isDisabled());
  await shot("buttons");
};
