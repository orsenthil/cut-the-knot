// ForcedCyclicQuad: two configurations of the illustration, with screenshots.
// There is no win or loss in this demo; the second one uses a negative add-on
// angle so E and F sit between B and C.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs forced-cyclic-quad
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };
  const angle = async (value) => {
    await page.fill("#angle", String(value));
    await page.locator("#angle").press("Tab");
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: positive add-on angle, E before B and F beyond C.
  await angle(28);
  await drag("B", 8, -14);
  await page.click("#premise");
  await page.click("#names");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: negative add-on angle, both E and F between B, C.
  await page.click("#resetBtn");
  await angle(-20);
  await drag("C", -10, 9);
  await page.click("#statement");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the same handle.
  await corner("D").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#less");
  await page.click("#more");
  log("after the angle buttons:", await page.inputValue("#angle"), await text("#status"));
  await angle(-99); // below the applet's minimum
  log("below minimum:", await page.inputValue("#angle"));
  await angle(99); // above the applet's maximum
  log("above maximum:", await page.inputValue("#angle"));
  await page.click("#statement");
  await page.click("#statement");
  await page.click("#premise");
  await page.click("#premise");
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after Reset:", await page.inputValue("#angle"), await text("#status"));
};
