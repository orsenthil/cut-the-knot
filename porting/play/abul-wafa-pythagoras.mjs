// Abul Wafa Pythagoras: drag the squares into two shapes, then slide the
// seven pieces into the square on the third side.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs abul-wafa-pythagoras
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 680) * box.width,
    y: box.y + (y / 380) * box.height,
  });
  const drag = async (from, to) => {
    const a = toClient(from[0], from[1]), b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  const settle = async (name) => {
    await shot(name);
    log(name + ":", await text("#readout"), "|", await text("#status"));
  };

  log("initial:", await text("#readout"), "|", await text("#status"));
  await shot("start");

  // First shape: meet the corners, then make a large right triangle.
  await drag([217.5, 310], [30, 310]);
  await drag([123.75, 310], [170, 310]);  // a = 140
  await drag([170, 247.5], [170, 180]);   // b = 130
  await settle("config1-start");

  await page.click("#moveBtn");
  await page.waitForTimeout(3900);
  await settle("config1-assembled");

  if (!first) return;

  // Second shape: a tall, thin triangle, dragged with a at its maximum.
  await drag([170, 180], [170, 260]);     // b = 50
  await drag([170, 310], [180, 310]);     // a = 150
  await settle("config2-start");

  await page.locator("#board circle.resize-handle").nth(1).focus();
  await page.keyboard.press("ArrowUp");
  log("keyboard after drag: b =", await text("#readout"),
    "| focus =", await page.evaluate(() => document.activeElement.getAttribute("aria-label")?.slice(0, 12)));

  await page.click("#moveBtn");
  await page.waitForTimeout(3900);
  await settle("config2-assembled");
};
