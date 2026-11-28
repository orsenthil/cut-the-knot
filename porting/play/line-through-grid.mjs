// Line Through Grid: explore two rectangles and capture each picture.
// There is no win or loss: this is an illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs line-through-grid
export default async ({ page, first, log, shot, idle, text }) => {
  // The coprime example: page's 6 by 11 default, no interior grid points.
  log("default 6 by 11:", await text("#status"));
  await idle();
  await shot("coprime");

  if (!first) return; // the dark run only needs the first picture

  // The exceptional example: 6 by 9 has gcd 3, so two squares drop out.
  await page.fill("#mInput", "6");
  await page.dispatchEvent("#mInput", "change");
  await page.fill("#nInput", "9");
  await page.dispatchEvent("#nInput", "change");
  await idle();
  log("6 by 9 (gcd 3):", await text("#status"));
  await shot("common-factor");

  // Largest options on a phone must not overlap or spill; the stage scales.
  await page.fill("#mInput", "50");
  await page.dispatchEvent("#mInput", "change");
  await page.fill("#nInput", "50");
  await page.dispatchEvent("#nInput", "change");
  await idle();
  log("largest 50 by 50:", await text("#status"));
  await shot("largest");
};
