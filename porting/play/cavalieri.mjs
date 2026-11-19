// Cavalieri's Principle: a demo, so "explored" is the end state. Open it, push
// every option to its maximum, move a bar with the keyboard alone (checking
// focus stays on the board), press every button, then visit both option
// extremes. The status sentence says in words what each action changed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cavalieri
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  log("initial:", await text("#status"));
  await shot("start");
  if (!first) return; // the dark run only needs the opening screenshot

  // Every option at its maximum: most strips, the vertical layout, lines on.
  await page.locator("#nInput").evaluate((el) => {
    el.value = "100";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("100 strips:", await text("#status"));
  await page.click("#verticalRadio");
  log("vertical layout:", await text("#status"));
  await page.check("#linesInput");
  log("lines on:", await text("#status"));
  await shot("options-max");

  // Two keyboard moves with a focus check: the board must keep the focus.
  await page.focus("#cavalieriCanvas");
  await page.keyboard.press("ArrowRight");
  const focus1 = await focus();
  await page.keyboard.press("ArrowRight");
  const focus2 = await focus();
  log("two arrow moves:", await text("#status"), "| focus after each:", focus1, focus2);

  // Press every button in the order a player would.
  await page.click("#prevBtn");
  log("Previous:", await text("#status"));
  await page.click("#nextBtn");
  log("Next:", await text("#status"));
  await page.click("#backBtn");
  log("Shift back:", await text("#status"));
  await page.click("#fwdBtn");
  log("Shift on:", await text("#status"));
  await page.click("#resetBtn");
  log("Reset:", await text("#status"));
  await shot("reset");

  // Both extremes of every option, with words describing each change.
  await page.locator("#nInput").evaluate((el) => {
    el.value = "5";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("5 strips (minimum):", await text("#status"));
  await shot("min-strips");

  await page.locator("#nInput").evaluate((el) => {
    el.value = "100";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("100 strips (maximum):", await text("#status"));

  await page.click("#horizontalRadio");
  log("horizontal layout:", await text("#status"));
  await page.click("#verticalRadio");
  log("vertical layout again:", await text("#status"));

  await page.uncheck("#linesInput");
  log("lines off:", await text("#status"));
  await page.check("#linesInput");
  log("lines on again:", await text("#status"));
  await shot("both-extremes");
};
