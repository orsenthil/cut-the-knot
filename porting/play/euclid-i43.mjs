// Two configurations of Euclid I.43: one divisor point moved by keyboard,
// then ten divisor points on a fresh slant with a corner dragged by pointer.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euclid-i43
export default async ({ page, log, shot, text }) => {
  const handles = page.locator("#board .geom-handle");

  // Configuration 1: the applet's starting picture, N = 1. Move K1 with the
  // arrow keys alone and check that the focus stays on the handle.
  await handles.nth(4).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("one point:", await text("#status"));
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label")));
  await shot("one-point");

  // Configuration 2: the largest option (N = 10), a new slant, and a pointer
  // drag of corner A. Screenshot at phone width in both themes.
  for (let i = 0; i < 9; i++) await page.click("#plusBtn");
  await page.click("#newBtn");
  const box = await handles.nth(0).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  log("ten points:", await text("#status"));
  log("points control:", await page.inputValue("#nInput"));
  await shot("ten-points");

  // Press the remaining buttons and push the spinner past both ends of its
  // 0..10 range. The page must clamp and keep the status in step.
  await page.click("#minusBtn");
  log("after minus:", await page.inputValue("#nInput"));
  await page.fill("#nInput", "-3");
  log("below minimum:", await page.inputValue("#nInput"));
  await page.fill("#nInput", "99");
  log("above maximum:", await page.inputValue("#nInput"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
