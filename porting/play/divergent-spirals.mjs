// DivergentSpirals: two configurations of the illusion.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs divergent-spirals
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#board .geom-handle");
  log("initial:", await text("#status"));

  // First configuration: the applet's defaults, rotating fast and clockwise.
  await page.click("#runBtn"); // Start; Fast and Slow become available.
  await page.click("#fastBtn");
  await page.waitForTimeout(400);
  log("fast clockwise:", await text("#status"));
  await shot("clockwise-fast");

  // Second configuration: the largest allowed arc angle and overlap,
  // turning the other way. The page says both spirals then seem to converge.
  await page.click("#runBtn"); // Stop.
  await page.click("#ccwBtn");
  await page.locator("#openingInput").evaluate((el) => {
    el.value = "90";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#overlapInput").evaluate((el) => {
    el.value = "11";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click("#runBtn");
  await page.waitForTimeout(400);
  log("counterclockwise, 90 degrees and overlap 11:", await text("#status"));
  await shot("counterclockwise-max");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: the turn handle keeps focus and the status follows it.
  await page.click("#runBtn"); // Stop.
  await page.locator("#board .geom-handle").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard turn:", await text("#status"));

  // Press every button in a player's order, and move both sliders both ways.
  await page.click("#runBtn"); // Start again: speed buttons are enabled.
  await page.click("#slowBtn");
  log("slow:", await text("#status"));
  await page.click("#fastBtn");
  log("fast:", await text("#status"));
  await page.click("#cwBtn");
  await page.click("#runBtn"); // Stop.
  await page.locator("#openingInput").evaluate((el) => {
    el.value = "10";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#overlapInput").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("smallest settings:", await text("#status"));
  await page.click("#resetBtn");
  log("after Restore defaults:", await text("#status"));
};
