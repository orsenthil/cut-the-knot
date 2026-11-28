// Markowsky 2: set up two configurations, compare the drawn claims, and try
// every button and the keyboard handles. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs markowsky-2
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = async (id, value) => {
    await page.$eval("#" + id, (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, String(value));
  };

  await idle();
  log("start:", await text("#status"));

  // Configuration 1: well-separated points, both overlays on.
  await page.click("#namesBtn");
  await page.click("#tangentsBtn");
  await setRange("tA", -100);
  await setRange("tB", 20);
  await setRange("tC", 100);
  log("configuration 1:", await text("#status"));
  log("overlay buttons:",
    await page.getAttribute("#namesBtn", "aria-pressed"),
    await page.getAttribute("#tangentsBtn", "aria-pressed"));
  await shot("config-1");

  if (first) {
    // Two keyboard moves on a handle: focus must stay on it afterwards.
    await page.locator(".geom-layer-handles circle").first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const focus = await page.evaluate(() =>
      (document.activeElement && document.activeElement.getAttribute("aria-label")) || "");
    log("after two arrow keys:", await text("#status"));
    log("focus still on handle:", focus.slice(0, 24));

    // Sliders in the opposite direction, then Reset.
    await setRange("tA", 250);
    await setRange("tB", -250);
    await setRange("tC", 90);
    log("opposite ends:", await text("#status"));
    await page.click("#newBtn");
    log("after Reset:", await text("#status"));
  }

  // Configuration 2: equal parameters, the applet's freeze state.
  await setRange("tA", 120);
  await setRange("tB", 120);
  await setRange("tC", -40);
  log("configuration 2:", await text("#status"));
  await shot("config-2");
};
