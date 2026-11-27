// Four Circle Sangaku: show two configurations of the same diagram.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs four-circle-sangaku
export default async ({ page, first, log, shot, text }) => {
  await shot("start");
  log("opening picture:", await text("#status"));

  // The second configuration: C turned away from the start, with the tangent
  // construction revealed by the applet's own "hint" option.
  await page.click("#rightBtn");
  await page.click("#rightBtn");
  await page.click("#hintChk");
  await shot("hint");
  log("after turning right twice with hint:", await text("#status"));

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard play keeps focus on C, and New diagram restores the opening angle.
  const handle = page.locator("#board .geom-handle").first();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("C still focused after two arrow keys:", await handle.evaluate((el) => el === document.activeElement));
  log("after keyboard moves:", await text("#status"));
  await shot("keyboard");

  await page.click("#namesChk");
  await page.click("#newBtn");
  log("after New diagram:", await text("#status"));
  await shot("reset");
};
