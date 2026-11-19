// The bicentric-quadrilateral demo: start with four dots on a circle, push
// every option to its extreme, make two keyboard moves while checking focus,
// press every control in player order, and describe each change in words.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bicentric-quadrilateral

export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  let box = await board.boundingBox();
  // The canvas has exactly the applet's 400 x 260 aspect ratio.
  const client = (x, y) => ({
    x: box.x + box.width * x / 400,
    y: box.y + box.height * y / 260,
  });
  const dragRadius = async (fromY, toY) => {
    const a = client(200, fromY);
    const b = client(200, toY); // the radius handle sits above the centre
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };

  log("initial:", await text("#status"));
  await shot("initial");

  // Every option at its maximum: names on, the circle as large as it goes,
  // and the right-angle (bicentric) case.
  await page.click("#namesCheck");
  await dragRadius(87, 6); // default radius 43 -> largest that fits (124)
  await page.click("#bicentricBtn");
  log("maximum options:", await text("#status"));
  await shot("max");

  if (first) {
    // Two keyboard moves; focus must stay on the drawing after each one.
    await board.focus();
    await page.keyboard.press("2");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
    log("focus after two keyboard moves:", focused);
    log("after keyboard moves:", await text("#status"));
    await shot("keyboard");
  }

  // Press every button in the order a player would.
  await page.click("#bicentricBtn");
  log("bicentric button:", await text("#status"));
  await shot("bicentric");
  await page.click("#resetBtn");
  log("reset button:", await text("#status"));

  // Both extremes of the only checkbox.
  await page.click("#namesCheck");
  log("names off:", await text("#status"));
  await page.click("#namesCheck");
  log("names on:", await text("#status"));

  // The other extreme of the radius: the smallest circle that still draws.
  box = await board.boundingBox();
  await dragRadius(87, 120); // reset left the radius at 43; drag it down to 10
  log("minimum circle:", await text("#status"));
  await shot("min");

  // Back to the bicentric state so the final screenshot shows the two circles.
  await page.click("#bicentricBtn");
  log("final:", await text("#status"));
  await shot("final");
};
