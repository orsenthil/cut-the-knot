// Plain Monty Hall: a round won by switching, a round lost by staying, then
// a round played with the keyboard alone, then Reset.
// Run with: NODE_PATH=... node porting/play.mjs plain-monty-hall
export default async ({ page, first, log, shot, text }) => {
  const settle = () => page.waitForTimeout(500);
  const base = page.url().split("?")[0];
  await page.goto(base + "?prize=1");          // the car is behind door 1
  await page.locator(".door").nth(1).click();  // pick door 2: the host opens door 3
  log("after the pick:", await text("#prompt"));
  await settle(); await shot("choose");
  await page.locator(".door").nth(0).click();  // switch to door 1: the car
  log("after a win:", await text("#status"));
  await settle(); await shot("win");
  if (!first) return;

  await page.goto(base + "?prize=1");
  await page.locator(".door").nth(1).click();  // pick door 2
  await page.locator(".door").nth(1).click();  // stay: a goat
  log("after a loss:", await text("#status"));
  await settle(); await shot("loss");

  const focus = () => page.evaluate(() => document.activeElement.getAttribute("aria-label"));
  await page.keyboard.press("Enter");          // the focused door 2 starts the next round
  log("keyboard pick:", await text("#prompt"), "| focus:", await focus());
  await page.keyboard.press("Enter");          // the same door again: stay
  log("keyboard choice:", await text("#status"), "| focus:", await focus());
  await page.locator("#resetBtn").click();
  log("after reset:", await text("#prompt"), await page.locator(".bar-count").allTextContents());
};
