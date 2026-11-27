// Two configurations of the crossed-lines construction: a convex curve of
// constant width and a non-convex one. The status line says which is which.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cw-crossed-lines
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the applet's starting point, beyond C on the line BC.
  log("convex:", await text("#status"));
  await page.click("#playBtn");
  log("playing:", await text("#status"));
  await shot("convex");

  // Configuration 2: slide P between B and C, where the curve bends inward.
  await page.locator("#pRange").fill("0.5");
  log("non-convex:", await text("#status"));
  await shot("nonconvex");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard check: move the P handle with the arrow keys and keep focus.
  const pHandle = page.locator('#board circle[role="button"]').nth(3);
  await pHandle.focus();
  await page.keyboard.press("ArrowRight");
  log("after ArrowRight on P:", await text("#status"));
  log("focus after the move:", await page.evaluate(() => document.activeElement?.getAttribute("role")));

  // Press every control in the order a visitor would.
  await page.click("#linesBox");
  log("lines hidden:", await text("#status"));
  await page.click("#dotsBox");
  log("dots hidden:", await text("#status"));
  await page.fill("#speedIn", "20");
  await page.locator("#speedIn").press("Tab");
  log("speed:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
