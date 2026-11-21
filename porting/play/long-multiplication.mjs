// Long multiplication demo: try the page examples and toggle compact rows.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs long-multiplication

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("readout:", await text("#readout"));
  await shot("start");

  await page.uncheck("#compactCheck");
  log("full rows:", await text("#readout"));
  await shot("full");

  if (first) {
    await page.fill("#aInput", "23");
    await page.locator("#aInput").press("Enter");
    await page.fill("#bInput", "46");
    await page.locator("#bInput").press("Enter");
    log("23 by 46:", await text("#readout"));
    await shot("small");
  }

  await page.check("#compactCheck");
  log("compact again:", await text("#status"));
  await shot("compact");
};
