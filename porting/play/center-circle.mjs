// Center Circle: two configurations of the same illustration, with all the
// guide layers switched on. Nothing here can be won or lost.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs center-circle
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: the applet's four starting lines and every guide layer.
  for (const id of ["#circlesBtn", "#centersBtn", "#commonBtn"]) await page.click(id);
  await page.click("#checkBtn");
  log("four lines, all guides:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("four-lines");

  // Second configuration: all seven lines, the largest setting the page has.
  for (let i = 5; i <= 7; i++) await page.click(`#line${i}Btn`);
  await page.click("#checkBtn");
  log("seven lines, all guides:", await text("#status"));
  await shot("seven-lines");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the dragged point; the picture follows.
  const handle = page.locator('#board [aria-label^="Line 1, first"]');
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in both directions, as a player would.
  for (const id of ["#circlesBtn", "#centersBtn", "#commonBtn"]) {
    await page.click(id);
    await page.click(id);
  }
  for (let i = 1; i <= 7; i++) {
    await page.click(`#line${i}Btn`);
    await page.keyboard.press(String(i)); // the same toggle from the keyboard
  }
  log("after every line toggled twice:", await text("#status"));

  await page.click("#newBtn");
  await page.click("#checkBtn");
  log("after New lines:", await text("#status"));
};
