// Circle Center By Ruler: explore two configurations and check the claims.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-center-by-ruler
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}."]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: move B' right and down, opening up the second circle.
  await drag("Bp", 26, 34);
  log("after B' moved:", await text("#status"));
  await page.click("#centerBtn");
  await page.click("#hintBtn");
  await shot("configuration-one");

  await page.click("#checkBtn");
  log("after Check the claims:", await text("#status"));

  // Configuration 2: reset, then move M and A to make a different pair of circles.
  await page.click("#newBtn");
  await drag("M", -32, 16);
  await drag("A", 30, -28);
  log("after M and A moved:", await text("#status"));
  await page.click("#checkBtn");
  await shot("configuration-two");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard: two arrow keys on a focusable handle keep the focus there.
  await handle("N").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button, and flip every toggle back the other way.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#centerBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
