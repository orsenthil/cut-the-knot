// Arrange Pyth: a droodle, so there is no win or loss. Show two different
// splits of the bottom edge and the two cuts they produce.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs arrange-pyth
export default async ({ page, first, log, shot, text }) => {
  const box = await page.locator("#board").boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 500) * box.width,
    y: box.y + (y / 300) * box.height,
  });
  const dragM = async (fromX, toX) => {
    const a = toClient(fromX, 205), b = toClient(toX, 205);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };
  const settle = async (name) => {
    await shot(name);
    log(name + ":", await text("#readout"), "|", await text("#status"));
  };

  log("initial:", await text("#readout"), "|", await text("#status"));
  await shot("start");

  // First split: a long thin triangle pair (a = 90, b = 20).
  await dragM(83, 160);
  await settle("config1");

  // Second split: reset, then drag to a = 42, b = 68 and use the keyboard.
  await page.click("#resetBtn");
  await dragM(83, 112);
  if (first) {
    await page.locator("#board circle.m-handle").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    log("keyboard: a = 44, b = 66?", await text("#readout"),
      "| focus =", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.slice(0, 12)));
  }
  await settle("config2");

  await page.click("#midBtn");
  log("midpoint:", await text("#readout"));
};
