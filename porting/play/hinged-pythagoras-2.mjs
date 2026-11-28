// Hinged Pythagoras 2: explore two configurations of the hinged dissection.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-pythagoras-2
export default async ({ page, first, log, shot, text }) => {
  const setSlider = (id, value) => page.locator(id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  // Configuration 1: the applet's starting state, Rotation 0 and ForSine 30.
  log("config 1:", await text("#readout"), "|", await text("#status"));
  await shot("config1");

  // Configuration 2: a wider triangle (60°) part-way through the swing (90°).
  await setSlider("#beta", 60);
  await setSlider("#rotation", 90);
  log("config 2:", await text("#readout"), "|", await text("#status"));
  await shot("config2");

  if (!first) return;

  // The gold tip is a real focusable handle: two arrow presses must change
  // the angle and leave focus on the handle for the next key press.
  await page.locator("circle.turn-handle").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("after arrow keys:", await text("#rotationOut"), "| focus:",
    await page.evaluate(() => document.activeElement?.getAttribute("class")));

  // The gold cut handle changes the shape with the keyboard alone too.
  await page.locator("circle.shape-handle").focus();
  await page.keyboard.press("ArrowUp");
  log("after shape key:", await text("#betaOut"));

  await page.click("#endBtn");
  log("after Turn to the end:", await text("#rotationOut"), "|", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#rotationOut"), await text("#betaOut"), "|", await text("#status"));
};
