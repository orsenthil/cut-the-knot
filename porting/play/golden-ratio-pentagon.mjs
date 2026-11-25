// Golden Ratio in an Irregular Pentagon: drag a free point and the ratio stays 3.618.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs golden-ratio-pentagon
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("start");
  const x = page.locator('[tabindex][data-k="X"]');
  await x.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  log("after moving X:", await text("#readout"));
  await shot("moved");
  if (!first) return;
  await page.uncheck("#namesBox");
  await page.uncheck("#earsBox");
  log("status:", await text("#status"));
};
