// The Base Converter demo: type numbers, turn every base to its extremes,
// press every button, and read what the status says changed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs base-conversion

export default async ({ page, log, shot, text }) => {
  const boxes = async () =>
    (await page.locator(".num-input").evaluateAll((els) => els.map((e) => e.value))).join(" | ");
  const bases = async () =>
    (await page.locator(".base-input").evaluateAll((els) => els.map((e) => e.value))).join(" | ");

  log("at the start, bases:", await bases(), "boxes:", await boxes());
  log("at the start, status:", await text("#status"));
  await shot("start");

  // Every option to its maximum: all four bases become 36.
  for (let i = 0; i < 4; i++) {
    await page.fill(`#base${i}`, "36");
    await page.press(`#base${i}`, "Tab");
  }
  log("every base at its maximum:", await bases());
  log("status now says:", await text("#status"));
  await shot("max-bases");

  // Two moves using the keyboard alone, checking focus survives each one.
  await page.fill("#text0", "255");
  await page.press("#text0", "Enter");
  let focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
  log("after the first Enter, focus is on:", focus, "| boxes:", await boxes());
  log("status class after a move:", await page.getAttribute("#status", "class"));
  await shot("keyboard-one");

  await page.fill("#text1", "Z");
  await page.press("#text1", "Enter");
  focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
  log("after the second Enter, focus is on:", focus, "| status:", await text("#status"));
  await shot("keyboard-two");

  // Press every button in the order a player would: both steppers on each
  // row, then Convert, then Reset.
  for (let i = 0; i < 4; i++) {
    await page.click(`#minus${i}`);
    await page.click(`#plus${i}`);
  }
  await page.click("#convertBtn");
  log("after Convert:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset, bases:", await bases(), "boxes:", await boxes());
  await shot("buttons");

  // Both extremes for every option: a base below 2 and a base above 36.
  for (let i = 0; i < 4; i++) {
    await page.fill(`#base${i}`, "1");
    await page.press(`#base${i}`, "Tab");
    log(`box ${i + 1} with a base of 1 follows the applet and shows:`, (await bases()).split(" | ")[i]);
    await page.fill(`#base${i}`, "100");
    await page.press(`#base${i}`, "Tab");
    log(`box ${i + 1} with a base of 100 follows the applet and shows:`, (await bases()).split(" | ")[i]);
  }
  await shot("extremes");

  // Finish with a fraction and say in words what the status reports.
  await page.fill("#text0", "3.5");
  await page.press("#text0", "Enter");
  log("final boxes:", await boxes());
  log("final status:", await text("#status"));
  await shot("final");
};
