// Circles Lined On Tri Sides: show two Pythagorean configurations and the
// picture that compares the big circle with the small ones.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-lined-on-tri-sides
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Number ${name}"]`);

  await idle("#board .geom-handle");
  log("first configuration:", await text("#status"));
  await shot("three-four-five");

  await page.click("#statementBtn");
  log("with the R picture:", await text("#status"));
  await shot("statement");

  // Press the N dot three times right and the M dot once left: N=4, M=1.
  await handle("N").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await handle("M").focus();
  await page.keyboard.press("ArrowLeft");
  log("second configuration:", await text("#status"));
  await shot("eight-fifteen");

  if (!first) return; // the dark run only needs the three screenshots

  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));

  // Keyboard-only moves keep the focus on the same handle.
  await handle("M").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#statementBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
