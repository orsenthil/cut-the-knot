// Feuerbach Incidence: two triangle configurations, no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs feuerbach-incidence
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the opening triangle with every overlay the applet has.
  await page.check("#namesChk");
  await page.check("#circlesChk");
  await page.check("#linesChk");
  await page.check("#lineChk");
  log("all overlays on:", await text("#status"));
  await shot("all-overlays");

  async function drag(index, dx, dy) {
    const h = page.locator("#board .geom-handle").nth(index);
    const box = await h.boundingBox();
    if (!box) throw new Error("handle " + index + " is not on the board");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  // Configuration 2: a shorter, wider triangle; the patterns must survive.
  await drag(2, -36, 26);
  await drag(1, 24, -14);
  log("after dragging B and C:", await text("#status"));
  await shot("moved-triangle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the moved handle.
  await page.locator("#board .geom-handle").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  log("focus after three arrow moves:",
    await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("class")));
  log("after keyboard moves:", await text("#status"));

  // The applet disables concurrence and collinearity when circles are off.
  await page.uncheck("#circlesChk");
  log("circles off:", await text("#status"));
  log("incidence switches disabled:", await page.isDisabled("#linesChk") && await page.isDisabled("#lineChk"));
  await page.check("#circlesChk");
  log("circles back on:", await text("#status"));
  await page.uncheck("#namesChk");
  await page.check("#namesChk");
  await page.click("#resetBtn");
  log("after New triangle:", await text("#status"));
};
