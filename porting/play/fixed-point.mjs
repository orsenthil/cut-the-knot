// Fixed Point: watch one trip and two trips on the starting equilateral
// triangle, then drag C into a scalene triangle and show the hint.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fixed-point
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, target) => {
    const dot = await handle(name).boundingBox();
    const box = await page.locator("#board").boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 500) * box.width,
      box.y + (target.y / 400) * box.height,
      { steps: 12 },
    );
    await page.mouse.up();
  };
  const go = async () => {
    await page.click("#goBtn");
    // Go stays disabled while the applet's step-by-step rotation runs.
    await idle(() => !document.getElementById("goBtn").disabled);
  };

  // Configuration 1: the applet's equilateral start; its midpoint is fixed.
  log("on opening:", await text("#status"));
  await go();
  log("after one trip:", await text("#status"));
  await shot("equilateral-one-trip");

  await go();
  log("after two trips:", await text("#status"));
  await shot("equilateral-two-trips");

  if (!first) return; // the dark run has taken all four screenshots already

  // Configuration 2: a scalene triangle, with the incircle and fixed point.
  await drag("C", { x: 300, y: 65 });
  await page.click("#hintBtn");
  log("scalene, hint on:", await text("#status"));
  await go();
  log("scalene after one trip:", await text("#status"));
  await shot("scalene-one-trip");

  // Arrow keys keep focus on the corner after the drag and the press of Go.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused.slice(0, 30));
  if (!focused.startsWith("Point A")) throw new Error("keyboard focus left point A");
  log("after keyboard move:", await text("#status"));

  // Press every control again, in a player's order, and check the reset.
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  if ((await text("#hintBtn")) !== "Hint: off") throw new Error("reset did not clear the hint");
};
