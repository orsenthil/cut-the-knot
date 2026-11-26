// BOL2: two configurations of the illustration, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-2
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1 — the diagram as the applet opens it.
  log("default:", await text("#status"));
  await shot("default");

  // Configuration 2 — move D with the keyboard alone, reveal the proof hint
  // and the statement, then check the claim.
  const handle = await page.$('#board [aria-label^="Point D"]');
  if (!handle) throw new Error("no handle for point D");
  await handle.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowUp");
  if (first) {
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after arrow keys:", focused);
  }
  log("after moving D:", await text("#status"));
  await page.click("#hintBox");
  await page.click("#statementBox");
  await page.click("#checkBtn");
  log("after checking:", await text("#status"));
  await shot("checked");

  if (!first) return; // the dark run only needs the two screenshots above

  // The reset button and the names switch must both still work.
  await page.click("#namesBox");
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
