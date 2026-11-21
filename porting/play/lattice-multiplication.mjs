// Lattice multiplication demo: try the two page examples and a no-carry case.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lattice-multiplication

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("start");

  if (first) {
    await page.fill("#aInput", "124576");
    await page.locator("#aInput").press("Enter");
    await page.fill("#bInput", "3857");
    await page.locator("#bInput").press("Enter");
    log("large example:", await text("#status"));
    log("readout:", await text("#readout"));
    await shot("large");
  }

  await page.fill("#aInput", "4566");
  await page.locator("#aInput").press("Enter");
  await page.fill("#bInput", "257");
  await page.locator("#bInput").press("Enter");
  log("simple example:", await text("#status"));
  await shot("simple");
};
