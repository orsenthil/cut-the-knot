// Every Trapezoid Is Para: two configurations of the illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs every-trapezoid-is-para
export default async ({ page, log, shot, text }) => {
  const handles = page.locator("#board .geom-handle");

  // Configuration 1: the starting trapezoid with unequal bases, the claim
  // marked on AG and CH, and the premise marked on the four equal base pieces.
  await page.click("#statement");
  await page.click("#premise");
  await handles.nth(0).focus(); // A
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("config 1 (start, marked claim):", await text("#status"));
  log("focus after keyboard drags:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));
  await shot("claim");

  // Configuration 2: a new shape, the dashed parallels shown, and the top
  // base dragged past the bottom one so G and H swap along the diagonal.
  await page.click("#newBtn");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  await handles.nth(3).focus(); // D
  for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");
  log("config 2 (new shape, long top base):", await text("#status"));
  log("focus after keyboard drags:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));
  await shot("hint");

  // Every control in the other direction, then the original picture again.
  await page.click("#resetBtn");
  await page.click("#statement");
  await page.click("#premise");
  await page.click("#hint");
  log("after reset:", await text("#status"));
};
