// Ratchet Effect: run Both, then each staircase alone, at both speeds.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ratchet
export default async ({ page, first, log, shot, text }) => {
  log("at the start:", await text("#readout"), "|", await text("#status"));
  await page.click("#goBtn");
  await page.waitForTimeout(3000);
  log("Both, slow, after 3 s:", await text("#readout"));
  await page.check('input[value="fast"]');
  await page.waitForTimeout(2500);
  log("Both, fast, after 2.5 s:", await text("#readout"));
  await shot("both");
  if (!first) return;

  await page.check('input[value="regular"]');
  await page.waitForTimeout(2000);
  log("Regular alone:", await text("#readout"), "|", await text("#status"));
  await page.check('input[value="flashing"]');
  await page.waitForTimeout(2000);
  log("Flashing alone:", await text("#readout"), "|", await text("#status"));
  await shot("flashing");
  await page.check('input[value="slow"]');
  await page.click("#goBtn");
  log("after Stop, button says:", await text("#goBtn"));
  await page.check('input[value="both"]');
  await page.focus("#goBtn");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  log("Go by keyboard:", await text("#goBtn"), "|", await text("#readout"));
  log("focus:", await page.evaluate(() => document.activeElement.id));
  await shot("final");
};
