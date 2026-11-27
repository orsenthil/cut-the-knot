// Equilateral 345: a 60-degree proof picture, then a turned-and-dragged one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equilateral-345
export default async ({ page, first, log, shot, text }) => {
  const setAngle = (v) => page.locator("#angle").evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
  const settle = async (name) => {
    log(name, "| angle", await text("#angleOut"), "|", await text("#status"));
    log(name, "readout:", await text("#readout"));
    await shot(name);
  };

  log("initial:", await text("#status"));
  await shot("start");

  // Configuration 1: the completed proof at the applet's 60 degrees.
  await page.click("#proofBtn");
  await page.locator("#names").check();
  await page.locator("#lengths").check();
  await settle("config1-proof");

  if (first) {
    // Two keyboard moves on a corner; focus must stay on the board afterwards.
    await page.locator("#board circle.vertex-handle").first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    log("keyboard focus:", await page.evaluate(() =>
      document.activeElement && (document.activeElement.getAttribute("aria-label") || "").slice(0, 44)));
    await shot("config1-keyboard");
  }

  // Configuration 2: the dial at its maximum 65 degrees, names off, with a
  // corner dragged to a new place while P stays where the applet put it.
  await page.click("#resetBtn");
  await setAngle(65);
  await page.locator("#names").uncheck();
  const handle = page.locator("#board circle.vertex-handle").nth(2);
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await settle("config2-65-dragged");

  await page.click("#resetBtn");
  log("after reset:", await text("#angleOut"), "|", await text("#status"));
};
