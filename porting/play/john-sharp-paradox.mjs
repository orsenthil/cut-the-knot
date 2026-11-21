// John Sharp's paradox demo: reveal the sliver, change the Fibonacci size,
// hide it again.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs john-sharp-paradox

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("areas:", await text("#readout"));
  await shot("start");

  await page.click("#revealBtn");
  log("revealed:", await text("#status"));
  log("sliver:", await page.locator(".sliver").count());
  await shot("revealed");

  if (first) {
    await page.locator("#nInput").fill("9");
    await page.locator("#nInput").dispatchEvent("input");
    log("at n=9:", await text("#readout"));
    log("status:", await text("#status"));
    await shot("n9");
  }

  await page.click("#revealBtn");
  log("hidden:", await text("#status"));
  await shot("hidden");
};
