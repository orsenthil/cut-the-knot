// Isosceles Triangle In Circle: two configurations of the diagram, with every
// button and overlay exercised. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs isosceles-triangle-in-circle
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a scalene triangle with all three overlays visible.
  await drag("Corner A", 18, 26);
  await page.click("#namesBtn");
  await page.click("#premiseBtn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("scalene, all overlays on:", await text("#status"));
  await shot("first");

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: reset, then move A onto the perpendicular bisector
  // of BC using the keyboard alone (five shift steps and two single steps).
  await page.click("#resetBtn");
  await handle("Corner A").focus();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.up("Shift");
  }
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("focus after keyboard moves:", await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || ""));

  // A final sub-step drag puts A exactly on BC's perpendicular bisector (x=200).
  const boardBox = await page.locator("#board").boundingBox();
  const from = await handle("Corner A").boundingBox();
  const toX = boardBox.x + (200 / 400) * boardBox.width;
  const toY = boardBox.y + ((250 / 3.5) / 250) * boardBox.height;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 8 });
  await page.mouse.up();

  // Reset keeps the overlays, so all three are still visible here.
  await page.click("#checkBtn");
  log("isosceles, overlays on:", await text("#status"));
  log("status classes:", await page.getAttribute("#status", "class"));
  await shot("second");

  // Press every remaining button and flip each option the other way.
  await page.click("#namesBtn");
  await page.click("#premiseBtn");
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#premiseBtn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("overlays off again:", await text("#status"));
  await page.click("#resetBtn");
  log("after final reset:", await text("#status"));
};
