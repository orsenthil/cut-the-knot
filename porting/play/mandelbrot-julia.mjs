// Mandelbrot/Julia demo: click two points, change the iteration limit, reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs mandelbrot-julia

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"), "|", await text("#readout"));
  await shot("start");

  const box = await page.locator("#mandelbrot").boundingBox();
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
  log("after a click:", await text("#readout"));
  log("status:", await text("#status"));
  await shot("clicked");

  if (first) {
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.2);
    log("outside the set:", await text("#status"));
    await shot("outside");
  }

  await page.fill("#iterInput", "96");
  await page.locator("#iterInput").dispatchEvent("input");
  log("more iterations:", await text("#readout"));
  await shot("iterations");

  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
  await shot("reset");
};
