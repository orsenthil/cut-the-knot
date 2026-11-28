// Hinged Pythagoras: two configurations of the hinged dissection.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-pythagoras
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  // The status line grows when the pieces reach 90°, so measure the board
  // again before each drag instead of caching its box once.
  const toClient = async (x, y) => {
    const box = await board.boundingBox();
    return { x: box.x + (x / 640) * box.width, y: box.y + (y / 460) * box.height };
  };
  const dragHinge = async (fromX, toX) => {
    const a = await toClient(fromX, 330), b = await toClient(toX, 330);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };

  log("start:", await text("#readout"), "|", await text("#status"));
  await shot("start");

  // Configuration 1: a=140, b=60, with the two hinges at 90 degrees.
  await dragHinge(106, 120);
  await page.click("#ninetyBtn");
  log("config1:", await text("#readout"), "|", await text("#angleOut"), "|", await text("#status"));
  await shot("config1-ninety");

  if (first) {
    // Arrow keys move the same handle and leave focus on it.
    await page.locator("circle.m-handle").focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    log("keyboard:", await text("#readout"), "| focus =",
      await page.evaluate(() => document.activeElement?.getAttribute("class")));
    await dragHinge(110, 120);
  }

  // Configuration 2: a=60, b=140, turned past the alignment to 95 degrees.
  await dragHinge(120, 200);
  await page.locator("#angleRange").focus();
  await page.keyboard.press("End");
  log("config2:", await text("#readout"), "|", await text("#angleOut"), "|", await text("#status"));
  await shot("config2-95");

  await page.click("#resetBtn");
  log("reset:", await text("#readout"), "|", await text("#angleOut"));
};
