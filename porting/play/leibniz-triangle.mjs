// Leibniz triangle demo: switch triangles, change rows and modulus.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs leibniz-triangle

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  log("cells:", await page.locator(".tri-cell").count());
  await shot("start");

  if (first) {
    await page.fill("#modInput", "2");
    await page.locator("#modInput").dispatchEvent("input");
    log("modulo 2:", await text("#status"));
    await shot("mod2");
  }

  await page.check('input[value="leibniz"]');
  log("Leibniz:", await text("#readout"));
  log("readout:", await text("#status"));
  await shot("leibniz");

  await page.fill("#rowsInput", "12");
  await page.locator("#rowsInput").dispatchEvent("input");
  log("12 rows:", await text("#readout"));
  await shot("rows12");
};
