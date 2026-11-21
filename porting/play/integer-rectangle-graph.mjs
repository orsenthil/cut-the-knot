// Integer rectangles graph demo: toggle graph/corners/path, select tiles,
// change dimensions and try the other tilings.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs integer-rectangle-graph

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("counting:", await text("#readout"));
  await shot("start");

  await page.check("#graphCheck");
  await page.check("#cornersCheck");
  log("edges:", await page.locator(".graph-edge").count(), "corners:", await page.locator(".corner").count());
  await shot("graph");

  if (first) {
    await page.locator(".tile").nth(1).click();
    await page.fill("#tileH", "1");
    log("after editing a tile:", await text("#status"));
    await shot("edited");
    await page.click("#kindBtn");
    log("after swapping kind:", await text("#readout"));
    await shot("kind");
  }

  await page.selectOption("#presetSel", "halfStep");
  log("halves preset:", await text("#status"));
  log("counting:", await text("#readout"));
  await shot("halves");
};
