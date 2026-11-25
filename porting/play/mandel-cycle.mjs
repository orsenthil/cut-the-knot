// Colour Cycling on the Mandelbrot Set: press Cycle, switch speed and direction, press Stop.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs mandel-cycle
export default async ({ page, first, log, shot, text }) => {
  const turns = () => page.evaluate(() => 0);
  const px = () => page.evaluate(() => Array.from(document.getElementById("pic").getContext("2d").getImageData(100, 20, 3, 1).data).join(","));
  log("before:", await px());
  await shot("start");
  await page.click("#goBtn");
  log("button now:", await page.locator("#goBtn").textContent(), "|", await text("#status"));
  await page.check("#fast");
  await page.waitForTimeout(400);
  log("moving:", await px());
  await shot("cycling");
  await page.check("#in");
  await page.waitForTimeout(200);
  await page.click("#goBtn");
  log("after stop:", await page.locator("#goBtn").textContent(), "|", await text("#status"));
  if (!first) return;
  await page.check("#slow");
  await page.click("#goBtn");
  await page.waitForTimeout(700);
  await page.click("#goBtn");
  log("slow, then stopped:", await text("#status"));
};
