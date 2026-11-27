// Contrast 2: three views of the same illusion (default, wide patches, tall
// bands), then keyboard movement and Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs contrast-2
export default async ({ page, first, log, shot, idle, text }) => {
  const setSlider = (id, value) => page.evaluate(([sliderId, v]) => {
    const input = document.getElementById(sliderId);
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id, value]);

  await idle("#board .patch");
  log("start:", await text("#status"));
  await shot("default");

  // Configuration one: short bands, patches at their widest, strong contrast.
  await setSlider("hRange", 40);
  await setSlider("wRange", 105);
  await setSlider("grayRange", 70);
  await setSlider("minRange", 10);
  await setSlider("maxRange", 90);
  log("wide patches:", await text("#status"));
  await shot("wide");

  if (!first) return; // the dark run only needs the two screenshots above

  // Configuration two: the tallest bands and narrow patches.
  await setSlider("hRange", 105);
  await setSlider("wRange", 20);
  await setSlider("grayRange", 50);
  await setSlider("minRange", 30);
  await setSlider("maxRange", 80);
  log("tall bands:", await text("#status"));
  await shot("tall");

  // The sample dot keeps focus while arrow keys step between patches.
  const dot = page.locator('#board [aria-label^="Sample dot on the left"]');
  await dot.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("after keyboard:", await text("#status"));

  // Sliders are real buttons to the keyboard too.
  await page.locator("#grayRange").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("after two slider arrows:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
