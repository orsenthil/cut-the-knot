// Integer Sine: the wrapped sine wave, then the plain-order Strang stripes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs integer-sine
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the applet's defaults - sin, Modulo 2*Pi on, 10 numbers.
  log("defaults:", await text("#status"));
  log("wrapped:", await page.isChecked("#modularBox"),
    "| sin pressed:", await page.getAttribute("#sinBtn", "aria-pressed"));
  await shot("wrapped-sine");

  if (!first) return; // the dark run only needs the screenshot above

  // Keyboard: the sample cursor must keep focus while it steps through dots.
  await page.focus("#board .sample-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("two arrow presses:", await text("#status"));
  log("focus still on the board:",
    await page.evaluate(() => document.activeElement?.classList.contains("sample-handle")));
  await page.keyboard.press("Home");
  log("Home returns to the first dot:", await text("#status"));

  // Configuration 2: untick the wrap and choose the largest scale.
  await page.click("#modularBox");
  await page.click('[data-scale="10240"]');
  log("plain, 10240:", await text("#status"));
  log("wrapped now:", await page.isChecked("#modularBox"),
    "| scale pressed:", await page.getAttribute('[data-scale="10240"]', "aria-pressed"));
  await shot("plain-sine-stripes");

  // Press every other control and both directions of the checkbox and scales.
  await page.click("#tanBtn");
  log("plain tan:", await text("#status"), `| ${await page.locator("#board .dots").getAttribute("d")}`.length, "path chars");
  await page.click("#modularBox");
  log("wrapped tan:", await text("#status"));
  await page.click('[data-scale="10"]');
  log("back to 10:", await text("#status"));
  await page.click("#sinBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
