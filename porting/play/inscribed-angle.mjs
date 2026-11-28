// Two configurations of the Inscribed Angle illustration: the opening picture
// with the inscribed and central angles, then the tangent limit with C dragged
// onto A. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inscribed-angle
export default async ({ page, log, shot, text, first }) => {
  const handles = page.locator("#board circle.geom-handle");
  const count = await handles.count();
  if (count !== 3) throw new Error(`expected three handles, found ${count}`);

  log("opening:", await text("#status"));
  await shot("inscribed");

  if (first) {
    // Two keyboard moves on B must leave focus on the board handle.
    await handles.nth(1).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    if (!focused.startsWith("Point B")) throw new Error(`focus left the board: ${focused}`);
    log("after two arrow keys on B:", focused);
  }

  // Drag C onto A: the applet's distance < 1 pixel tangent case.
  const centers = await handles.evaluateAll((nodes) => nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }));
  await page.mouse.move(centers[2].x, centers[2].y);
  await page.mouse.down();
  await page.mouse.move(centers[0].x, centers[0].y, { steps: 14 });
  await page.mouse.up();
  const tangentStatus = await text("#status");
  log("after dragging C onto A:", tangentStatus);
  if (!tangentStatus.includes("tangent at A")) throw new Error("tangent case did not appear");
  await shot("tangent");

  // Press every control: names off and back on, then reset the picture.
  await page.locator("#names").uncheck();
  await page.locator("#names").check();
  await page.locator("#resetBtn").click();
  log("after reset:", await text("#status"));
  if ((await text("#status")).includes("tangent at A")) throw new Error("reset did not restore the picture");
};
