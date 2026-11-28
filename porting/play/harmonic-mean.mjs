// Harmonic Mean: two configurations, a completed relay, keyboard and every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs harmonic-mean
export default async ({ page, first, log, shot, idle, text }) => {
  const speedHandle = page.locator('#board [aria-label^="Selected leg"]');
  const done = () => idle(() => document.getElementById("status")?.classList.contains("done"));

  await idle("#board .speed-bar");
  log("start:", await text("#status"));

  // Configuration 1: two legs in the original "T vs V" view, then a full race.
  await page.locator("#legsInput").fill("2");
  await page.locator("#legsInput").press("Tab");
  await page.locator("#fasterBtn").click();
  await page.locator("#nextBtn").click();
  await page.locator("#slowerBtn").click();
  log("two legs:", await text("#status"));
  await shot("time-two-legs");

  await page.locator("#raceBtn").click();
  await done();
  log("after the race:", await text("#status"));
  await shot("race-finished");

  // Start again, then stop early: the button and the disabled controls follow the applet.
  await page.locator("#raceBtn").click();
  log("while running:", await text("#status"));
  await page.locator("#raceBtn").click();
  log("after stopping early:", await text("#status"));

  if (!first) return; // the dark run only needs the two configuration screenshots

  // Configuration 2: equal-width bars at the largest leg count.
  await page.locator("#vsDistBtn").click();
  await page.locator("#legsInput").fill("1");       // below the applet's minimum
  await page.locator("#legsInput").press("Tab");
  log("legs below minimum:", await page.locator("#legsInput").inputValue());
  await page.locator("#legsInput").fill("99");      // above the applet's maximum
  await page.locator("#legsInput").press("Tab");
  log("legs above maximum:", await page.locator("#legsInput").inputValue());
  await page.locator("#legsUp").click();
  await page.locator("#legsDown").click();
  await page.locator("#legsUp").click();
  log("at the maximum:", await text("#status"));
  await shot("distance-40-legs");

  // Two keyboard moves must keep focus on the handle and change the speed.
  await speedHandle.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("after keyboard:", await text("#status"));

  for (const id of ["#prevBtn", "#nextBtn", "#slowerBtn", "#fasterBtn",
                    "#vsTimeBtn", "#vsDistBtn", "#newBtn"]) {
    await page.locator(id).click();
  }
  log("after every control:", await text("#status"));
};
