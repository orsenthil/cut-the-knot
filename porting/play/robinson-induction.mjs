// Robinson induction demo: split, extend a green tile, remove and close;
// then run the whole induction and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs robinson-induction

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("start");

  if (first) {
    await page.click("#splitBtn");
    log("after split:", await text("#status"));
    await shot("split");
    await page.locator(".tile.htile").first().click();
    await page.click("#extendBtn");
    log("after extend:", await text("#status"));
    await shot("extend");
    await page.click("#removeBtn");
    log("after remove:", await text("#status"));
    await shot("remove");
    await page.click("#closeBtn");
    log("after close:", await text("#status"));
    await shot("close");
  }

  await page.click("#resetBtn");
  await page.click("#inductBtn");
  log("after full induction:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("induct");
};
