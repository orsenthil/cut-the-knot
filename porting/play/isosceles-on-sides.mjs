// Isosceles On Sides: two configurations of the diagram, with every option and
// button exercised. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs isosceles-on-sides
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

  // First configuration: a compact triangle, the attached point F pulled down,
  // and all three optional overlays visible.
  await drag("Corner A", 55, -30);
  await drag("Point F", 0, 25);
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("after moving A and F, with hints on:", await text("#status"));
  await shot("first");

  if (!first) return; // dark run only needs the two screenshots

  // Second configuration: reset, move B, and push D across its side so the
  // small triangle on BC turns over to the other side.
  await page.click("#resetBtn");
  await drag("Corner B", -48, 18);
  await drag("Point D", -30, -55);
  log("after moving B and flipping D:", await text("#status"));
  await shot("second");
  log("status classes:", await page.getAttribute("#status", "class"));

  // Keyboard alone: focus survives two arrow presses and the diagram redraws.
  await handle("Corner C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:", await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every button, and flip each option back the other way.
  await page.click("#checkBtn");
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  log("all overlays off again:", await text("#status"));
  await page.click("#resetBtn");
  log("after final reset:", await text("#status"));
};
