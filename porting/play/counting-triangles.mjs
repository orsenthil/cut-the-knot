// Counting Triangles: the triangle end, the square end, and a middle position.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs counting-triangles
export default async ({ page, first, log, shot, text }) => {
  log("triangle end:", await text("#status"));
  await shot("triangle");
  await page.fill("#aIn", "128");
  await page.dispatchEvent("#aIn", "input");
  log("middle:", await text("#readout"));
  await shot("middle");
  if (!first) return;
  await page.fill("#aIn", "0");
  await page.dispatchEvent("#aIn", "input");
  log("square end:", await text("#status"));
  await shot("square");
};
