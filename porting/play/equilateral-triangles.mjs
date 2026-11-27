// Equilateral Triangles: two configurations of the three draggable corners.
// The first keeps every point on the circle; the second frees them and shows
// that the green midpoint triangle is still equilateral.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equilateral-triangles
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 400) * box.width,
    y: box.y + (y / 300) * box.height,
  });
  const handles = page.locator("#board circle.point-handle");
  const dragHandle = async (i, target) => {
    const h = await handles.nth(i).boundingBox();
    const from = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    const to = toClient(target[0], target[1]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  };
  const report = async (name) => {
    log(name + ":", await text("#readout"), "|", await text("#status"));
    await shot(name);
  };

  log("initial:", await text("#readout"), "|", await text("#status"));

  // Configuration 1: three corners dragged around the circle.
  await dragHandle(0, [160, 50]);
  await dragHandle(1, [300, 190]);
  await dragHandle(2, [80, 210]);
  await report("on-circle");

  // Two arrow-key moves must change the picture and leave focus on the board.
  await handles.nth(0).focus();
  const beforeKeys = await text("#readout");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("keyboard:", beforeKeys, "->", await text("#readout"),
    "| focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  await shot("keyboard");

  if (!first) return;

  // Configuration 2: release the circle parameter and drag the points well
  // inside/outside its circumference. The page's claim still holds.
  await page.uncheck("#restrictBox");
  await dragHandle(0, [90, 70]);
  await dragHandle(1, [330, 245]);
  await dragHandle(2, [175, 260]);
  await report("off-circle");

  // Reset, then put the circle back: both controls must be live.
  await page.click("#newBtn");
  log("after New picture:", await text("#readout"), "|", await text("#status"));
  await page.check("#restrictBox");
  await report("reset-on-circle");
};
