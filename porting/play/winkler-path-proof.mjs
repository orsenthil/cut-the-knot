// Winkler path proof demo: toggle decoration/borders, swap a tile's colour,
// and try the other presets.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs winkler-path-proof

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("start");

  await page.uncheck("#decorateCheck");
  await page.check("#bordersCheck");
  log("undecorated:", await text("#readout"));
  await shot("borders");

  if (first) {
    await page.locator(".tile").nth(2).click();
    await page.click("#kindBtn");
    log("after swapping a colour:", await text("#status"));
    await shot("swapped");
  }

  await page.selectOption("#presetSel", "greenStrip");
  log("green strip:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("green");
};
