// BalticDarij1: two triangle configurations, with the claim checked in each.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs baltic-darij-1
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const show = async (id, on) => {
    const box = page.locator(id);
    if ((await box.isChecked()) !== on) await box.click();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a compact triangle, with right angles and the lines shown.
  await drag("A", 55, -22);
  await show("#rightChk", true);
  await show("#linesChk", true);
  await page.click("#checkBtn");
  log("compact:", await text("#status"));
  await shot("compact");

  // Second configuration: reset, pull C across, then show the big circle too.
  await page.click("#newBtn");
  await drag("C", -58, -26);
  await drag("B", 22, -12);
  await show("#linesChk", false);
  await show("#bigCircleChk", true);
  await show("#equalChk", true);
  await page.click("#checkBtn");
  log("obtuse:", await text("#status"));
  await shot("obtuse");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the corner after the diagram redraws.
  await corner("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in player order and move every option both ways.
  for (const id of ["#namesChk", "#rightChk", "#equalChk", "#linesChk", "#bigCircleChk"]) {
    await show(id, false);
    await show(id, true);
  }
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
