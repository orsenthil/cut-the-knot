// Brahmagupta 2: two cyclic quadrilaterals, with the overlays pressed in the
// order a player would, plus a keyboard move that must keep focus on the board.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs brahmagupta-2
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 400) * box.width,
    y: box.y + (y / 250) * box.height,
  });
  const drag = async (index, from, to) => {
    const a = toClient(from[0], from[1]), b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  const settle = async (name) => {
    await shot(name);
    log(name + ":", await text("#status"));
  };

  await settle("start");

  // First quadrilateral: drag all four corners into a skewed shape, then
  // switch on the diagonals, switch off the names and show the hint.
  await drag(0, [156.7, 30.3], [100, 20]);
  await drag(1, [104.1, 165.6], [75, 155]);
  await drag(2, [156.7, 219.7], [205, 230]);
  await drag(3, [302.1, 104.3], [285, 80]);
  await page.click("#diagonalsBtn");
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await settle("config1");

  if (!first) return;

  // Two arrow-key moves from the keyboard alone; focus must stay on the corner.
  await page.locator("#board .geom-handle").nth(3).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("after keyboard:", await text("#status"), "| focus =", await page.evaluate(() =>
    document.activeElement.getAttribute("aria-label")?.slice(0, 24)));

  // Proof forces the other three overlays off and disables their buttons.
  await page.click("#proofBtn");
  log("proof:", await text("#status"), "| disabled =", await page.evaluate(() =>
    ["diagonalsBtn", "namesBtn", "hintBtn"].filter((id) => document.getElementById(id).disabled).length));
  await settle("config1-proof");
  await page.click("#proofBtn");
  log("proof off, restored:", await page.evaluate(() =>
    ["diagonalsBtn", "namesBtn", "hintBtn"].map((id) => document.getElementById(id).getAttribute("aria-pressed")).join(",")));

  // Reset, then a second configuration with a long thin quadrilateral.
  await page.click("#resetBtn");
  await drag(0, [156.7, 30.3], [225, 32]);
  await drag(1, [104.1, 165.6], [95, 92]);
  await drag(2, [156.7, 219.7], [185, 220]);
  await drag(3, [302.1, 104.3], [295, 165]);
  await settle("config2");
};
