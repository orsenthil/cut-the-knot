// Square Sieve: a few steps, then all of them, then a bigger N.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs square-sieve
export default async ({ page, first, log, shot, text }) => {
  for (let i = 0; i < 3; i++) await page.click("#stepBtn");
  log("after three steps:", await text("#status"));
  await shot("steps");
  await page.click("#finishBtn");
  log("after all steps:", await text("#status"));
  await shot("done");
  if (!first) return;
  await page.fill("#n", "250");
  await page.locator("#n").press("Enter");
  await page.click("#finishBtn");
  log("N = 250:", await text("#status"));
  await shot("big");
};
