// Newton's Method: start on the right (it homes in), then near the top of the hump (it wanders off).
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs newtons-method
export default async ({ page, first, log, shot, text }) => {
  await page.fill("#nIn", "5");
  await page.dispatchEvent("#nIn", "change");
  await page.fill("#x0In", "4.5");
  await page.dispatchEvent("#x0In", "change");
  log("after a start at 4.5:", await text("#status"));
  await shot("home");
  if (!first) return;
  await page.fill("#x0In", "0.6");
  await page.dispatchEvent("#x0In", "change");
  log("after a start at 0.6:", await text("#status"));
  await page.check("#pts");
  await shot("wander");
  await page.fill("#hN", "10");
  log("heron:", (await text("#heronOut")).split("\n").slice(0, 3).join(" | "));
};
