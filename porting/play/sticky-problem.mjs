/** Playwright scenario: Sticky Problem — break a four, then randomize. */
export default async ({ page, first, log, shot, idle, text }) => {
  await page.click("#standard");
  await idle();
  await page.check("#modeBreak");
  // Break the first length-4 (index 1) after 1 unit → 1+3.
  await page.locator(".stick").nth(1).locator(".cell").nth(1).click();
  await page.waitForTimeout(500);
  log("after break:", await text("#status"));
  await shot("mid");

  if (!first) return;

  await page.click("#reset");
  await idle();
  log("random:", await text("#status"));
  await shot("random");
};
