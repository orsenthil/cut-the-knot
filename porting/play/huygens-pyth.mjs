// Huygens Pyth: move C around its circle, turn the triangle with A and B,
// then use the keyboard and the two applet switches. It is a demo: there is
// no win or loss, so the two screenshots show two different configurations.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs huygens-pyth
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 500) * box.width,
    y: box.y + (y / 450) * box.height,
  });
  const handles = page.locator("#board circle[role='button']");
  const drag = async (index, target) => {
    const h = await handles.nth(index).boundingBox();
    const from = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    const to = toClient(target[0], target[1]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.mouse.up();
  };
  const report = async (name) => {
    log(name + ":", await text("#readout"), "|", await text("#status"));
    await shot(name);
  };

  await report("start");

  // Configuration 1: slide C round the circle and show the hint triangles.
  await drag(2, [390, 300]);
  await page.check("#hintCheck");
  await report("config1-hint");

  if (!first) return; // the dark run needs only the first configuration

  // Configuration 2: turn AB, change both acute angles, show the point names.
  await drag(0, [150, 260]);
  await drag(1, [330, 200]);
  await page.uncheck("#hintCheck");
  await page.check("#namesCheck");
  await report("config2-names");

  // Two arrow-key moves; focus must stay on C after the figure redraws.
  await handles.nth(2).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after two key presses:", await text("#readout"),
    "| focus:", await page.evaluate(() =>
      document.activeElement && document.activeElement.getAttribute("aria-label")?.slice(0, 24)));
  await shot("config2-keyboard");

  await page.click("#resetBtn");
  log("after reset:", await text("#readout"), "|", await text("#status"));
  await shot("reset");
};
