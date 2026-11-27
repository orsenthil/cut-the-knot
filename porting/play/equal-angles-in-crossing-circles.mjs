// Equal Chords in Crossing Circles: two configurations of an illustration
// (there is no win or loss). The first shows the claim and the helper lines;
// the second switches to "Adjust circles" and swings A with the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equal-angles-in-crossing-circles
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the opening picture with all the applet's displays on.
  await page.click("#namesCheck");
  await page.click("#hintCheck");
  await page.click("#statementCheck");
  log("configuration 1:", await text("#status"));
  await shot("equal-chords");

  // Keyboard only: move P and check that focus stays on the board handle.
  await page.focus("#handle-P");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  if (first) {
    const at = await page.evaluate(() => ({
      focused: document.activeElement && document.activeElement.id,
      px: document.getElementById("handle-P").getAttribute("cx"),
    }));
    log("after keyboard moves:", JSON.stringify(at));
  }
  log("after moving P:", await text("#status"));
  await shot("moved-P");

  // Configuration 2: let A redefine its circle and swing it far away.
  await page.click("input[name='adjust-mode'][value='circles']");
  await page.focus("#handle-A");
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight");
  log("configuration 2:", await text("#status"));
  await shot("other-circles");
};
