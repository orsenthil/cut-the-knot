// La Hire's Theorem: an illustration, so the two configurations stand in for
// a win and a loss. First the opening picture with A away from B's polar;
// then five Shift+ArrowUp and three ArrowUp presses on A put it on the line,
// waking the eyes and revealing C, D and the blue rays. The checkbox and the
// Reset button are both pressed in both directions.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lahire

export default async ({ page, first, log, shot, text }) => {
  const aHandle = page.locator('[aria-label^="Point A."]');

  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Keyboard only: step is 1 board unit, Shift takes 5. O=(120,300),
  // B=(120,187.5) and B's polar is at y=271.875, so 28 units up lands on it.
  await aHandle.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowUp");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");

  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after eight arrow presses:", focused.slice(0, 40));
  const drawn = await page.evaluate(() => ({
    a: document.querySelector('[aria-label^="Point A."]')?.getAttribute("cy"),
    rays: [...document.querySelectorAll(".ray")].filter((n) => n.style.display !== "none").length,
    dots: [...document.querySelectorAll(".inverse-dot")].filter((n) => n.style.display !== "none").length,
  }));
  log("touch drawing:", JSON.stringify(drawn));
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (first) {
    // Two more keyboard moves must not steal focus from the moved dot, and
    // breaking the touch must put the extra drawing away again.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    log("focus after two more keys:", (await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") || "")).slice(0, 40));
    log("after breaking the touch:", await text("#status"));
  }

  // Every control, in a player's order and in both directions.
  await page.uncheck("#namesChk");
  log("names hidden:", await page.locator(".pt-label:visible").count(), "labels visible");
  await page.check("#namesChk");
  log("names shown:", await page.locator(".pt-label:visible").count(), "labels visible");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  await shot("final");
};
