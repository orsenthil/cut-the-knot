// Langford/Skolem demo: switch kinds, sizes, copies and holes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs langford-skolem

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("cells:", await page.locator(".cell").count());
  await shot("start");

  if (first) {
    await page.fill("#nInput", "3");
    await page.locator("#nInput").dispatchEvent("input");
    log("n=3 (Langford):", await text("#status"));
    await shot("n3");
  }

  await page.check('input[value="skolem"]');
  await page.fill("#nInput", "4");
  await page.locator("#nInput").dispatchEvent("input");
  log("Skolem n=4:", await text("#status"));
  await shot("skolem");

  await page.selectOption("#hSel", "1");
  log("hooked:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("hooked");

  await page.selectOption("#mSel", "3");
  log("triples:", await text("#status"));
  await shot("triples");
};
