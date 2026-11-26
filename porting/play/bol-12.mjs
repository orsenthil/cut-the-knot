// BOL12: two arrangements of the draggable picture, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-12
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: T to the right of the circle, right-angle marks on.
  await drag("Outside point T", 40, 25);
  await page.click("#statementBtn");
  log("T to the right:", await text("#status"));
  await shot("first");

  // Second configuration: T below the diameter, with the proof hint showing.
  await page.click("#newBtn");
  await drag("Outside point T", -62, 137);
  await page.click("#hintBtn");
  log("T below the diameter:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Every switch in both directions, then the claim check.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));

  // Two keyboard moves keep focus on the handle and the picture follows.
  await handle("Outside point T").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
