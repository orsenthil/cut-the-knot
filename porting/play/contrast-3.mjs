// Contrast 3: explore two configurations of the simultaneous-contrast ring.
// There is no win or loss; the status explains in words what moved.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs contrast-3
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = (id, value) => page.locator("#" + id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  const report = async (name) => {
    log(name + ":", await text("#status"));
    await shot(name);
  };

  // Configuration 1: the applet's opening picture, with the ring unshifted.
  await idle();
  await report("config1-together");

  // Configuration 2: maximum contrast, ring at mid gray, right square slid
  // up and down. This is the page's "independent identities" moment.
  await setRange("maxInput", 100);
  await setRange("minInput", 0);
  await setRange("grayInput", 50);
  await setRange("minColorInput", 0);
  await setRange("maxColorInput", 100);
  await setRange("hInput", 35);
  await idle();
  await report("config2-slid-down");

  await setRange("hInput", -35);
  await idle();
  await report("config2b-slid-up");

  if (!first) return; // the dark run only needs the screenshots above

  // Keyboard only: move the slide dot up twice with the arrow keys and check
  // the slider and the focus both follow the handle.
  const before = Number(await page.locator("#hInput").inputValue());
  await page.locator("#board circle.slide-handle").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const after = Number(await page.locator("#hInput").inputValue());
  const focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label") || "");
  log("keyboard slide:", before, "->", after, "| focus =", focused);
  if (!(after < before) || !/^Slide handle for the right square/.test(focused)) {
    throw new Error("arrow keys did not slide the right square or lost focus");
  }
  await shot("config2c-keyboard");

  await page.click("#resetBtn");
  log("reset:", await text("#status"));
  await idle();
};
