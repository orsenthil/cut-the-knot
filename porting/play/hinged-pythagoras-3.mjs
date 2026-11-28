// Hinged Pythagoras 3: two configurations of the hinged dissection.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-pythagoras-3
export default async ({ page, first, log, shot, text }) => {
  const setSlider = (id, value) => page.locator(id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  // Configuration 1: the applet's start — hinge a=46, b=154, no turn.
  log("config 1:", await text("#readout"), "|", await text("#status"));
  await shot("config1");

  // Configuration 2: move the hinge to the middle and turn a quarter turn.
  await page.locator("circle.m-handle").focus();
  for (let i = 0; i < 11; i++) await page.keyboard.press("ArrowRight");
  await page.click("#turnBtn");
  log("config 2:", await text("#readout"), "|", await text("#status"));
  await shot("config2");

  if (!first) return;

  // Keyboard focus must stay on the handle after each arrow press.
  await page.locator("circle.m-handle").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after arrow keys:", await text("#readout"), "| focus:",
    await page.evaluate(() => document.activeElement?.getAttribute("class")));

  // The Java scrollbar declares 0..95 but stops at 90; the slider follows it.
  await setSlider("#turnRange", 50);
  log("slider 50:", await text("#turnOut"), "|", await text("#status"));
  await setSlider("#turnRange", 95);
  log("slider 95:", await text("#turnOut"), "|", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#readout"), await text("#turnOut"), "|", await text("#status"));
};
