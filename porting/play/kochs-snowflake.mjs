// Koch's Snowflake: the triangle, a few rounds, and the last one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs kochs-snowflake
export default async ({ page, first, log, shot, text }) => {
  log("N = 1:", await text("#readout"));
  for (const n of ["3", "8"]) {
    await page.fill("#nIn", n);
    await page.dispatchEvent("#nIn", "input");
    log(`N = ${n}:`, await text("#readout"));
    await shot("n" + n);
  }
  log("status:", await text("#status"));
};
