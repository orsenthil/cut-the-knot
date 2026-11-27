// Four Turtles: watch the same chase in both frames of reference.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-turtles
export default async ({ page, first, log, shot, idle, text }) => {
  const setN = (n) => page.locator("#nInput").evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, n);
  const waitForMeet = () => idle(() =>
    /met at the centre|watched the turtles meet/.test(document.getElementById("status").textContent));

  await idle("#board .geom-handle");
  log("initial:", await text("#status"));

  // First configuration: the applet's defaults, four turtles, still frame.
  await page.click("#runBtn");
  await waitForMeet();
  log("stationary, N=4:", await text("#status"));
  await shot("stationary-four");

  // Second configuration: the largest N, rotating frame, both trace styles.
  await page.click("#rotatingBtn");
  await setN(20);
  await page.click("#traceBtn");
  await page.click("#bothBtn");
  log("settings:", await text("#status"), "| N =", await page.locator("#nInput").inputValue());
  await page.click("#runBtn");
  await waitForMeet();
  log("rotating, N=20, Both:", await text("#status"));
  await shot("rotating-twenty");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone on the dial: focus must stay on it after both arrow keys.
  await page.locator("#board .geom-handle").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:", await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || ""));
  log("dial status:", await text("#status"));

  // Press every control in a player's order, including N below and above
  // the limits, and check the buttons the applet disables while running.
  await setN(2);
  log("N below the minimum:", await page.locator("#nInput").inputValue());
  await setN(21);
  log("N above the maximum:", await page.locator("#nInput").inputValue());
  await page.click("#nDown");
  await page.click("#nUp");
  await page.click("#fixedBtn");
  // Trace is still on from the second configuration, so the styles are live.
  await page.click("#whirlBtn");
  log("stationary, whirl only:", await text("#status"));
  await page.click("#spiralsBtn");
  log("spirals:", await text("#status"));
  await page.click("#bothBtn");
  await page.click("#traceBtn"); // Trace off also disables the styles.
  log("trace off, styles disabled:", await page.locator("#bothBtn").isDisabled());
  await page.click("#traceBtn");
  await page.click("#runBtn");
  log("while running, N disabled:", await page.locator("#nInput").isDisabled(),
    "| style disabled:", await page.locator("#spiralsBtn").isDisabled());
  await page.click("#runBtn"); // Stop: the controls come back.
  log("after Stop, N disabled:", await page.locator("#nInput").isDisabled());
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
