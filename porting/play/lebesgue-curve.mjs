// Lebesgue Curve: step through two configurations of the polygonal approximation.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lebesgue-curve
export default async ({ page, first, log, shot, idle, text }) => {
  // Configuration 1: order 1, the coarsest path through four centres.
  log("start:", await text("#status"));
  await shot("order-1");

  // Configuration 2: two clicks to order 3, a 8x8 grid, with the cursor moved.
  await page.click("#nextBtn");
  await page.click("#nextBtn");
  // Blur the button (the arrow-key handler ignores input/button focus), then
  // the first arrow reveals the cursor and focuses it; the next two move it.
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await idle();
  log("after two clicks and two arrow keys:", await text("#status"));
  await shot("order-3");

  // Exercise the rest of the buttons and the wrap at the finest order.
  if (first) {
    for (let i = 0; i < 5; i++) await page.click("#nextBtn");
    await idle();
    log("at the finest order:", await text("#status"));
    await shot("finest");
    await page.click("#nextBtn");
    await page.click('input[name="mode"][value="moore"]');
    await idle();
    log("after the wrap and mode change:", await text("#status"));
    await shot("wrapped");
  }
};
