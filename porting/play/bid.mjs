// BID: show two configurations of the decomposition, then exercise every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bid
export default async ({ page, first, log, shot, idle, text }) => {
  const angle = page.locator("#angle");
  const setAngle = async (value) => {
    await angle.fill(String(value));
    await angle.dispatchEvent("input");
  };
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the golden triangle, where both pairs are similar.
  await page.click("#goldenBtn");
  log("golden angle:", await text("#status"));
  log("slider after golden button:", await angle.inputValue());
  await shot("golden");

  // Second configuration: past 45 degrees, the lines cross.
  await page.click("#newBtn");
  await setAngle(55);
  log("after sliding to 55:", await text("#status"));
  await shot("crossing");

  if (!first) return; // the dark run only needs the two screenshots

  // The slider follows the applet's whole range, in both directions.
  await setAngle(20);
  log("at the minimum:", await text("#status"));
  await setAngle(80);
  log("at the maximum:", await text("#status"));
  await setAngle(45);

  // Keyboard movement keeps the focus on the dragged corner.
  await corner("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
