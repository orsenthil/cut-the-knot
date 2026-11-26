// Determinant by Elimination: step a few times, run to the end, a 6 x 6,
// the singular 3 x 3 if it comes up.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs determinant-elimination
export default async ({ page, first, log, shot, text }) => {
  for (let k = 0; k < 3; k++) await page.click("#stepBtn");
  log("after 3 steps:", (await text("#facts")).replace(/\s+/g, " "));
  await shot("steps");
  if (!first) return;
  await page.click("#endBtn");
  log("end:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await page.selectOption("#sizeIn", "6");
  await page.click("#endBtn");
  log("6 x 6:", await text("#status"));
  await shot("six");
};
