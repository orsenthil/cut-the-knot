// Cut Cube is an illustration: two configurations, no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cut-cube
export default async ({ page, first, log, shot, text }) => {
  await page.click('button[data-preset="pyramid"]');
  log("corner cut:", await text("#status"));
  await shot("pyramid");
  if (!first) return; // the dark run only needs the first screenshot

  await page.click('button[data-preset="hexagon"]');
  await page.click('input[name="style"][value="opaque"]');
  await page.click('input[name="mode"][value="combined"]');
  log("central cut:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("hexagon-combined");
};
