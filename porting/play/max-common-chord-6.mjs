// Max Common Chord 6: a drawing, so the two "positions" are the starting
// configuration and the best chord; there is no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs max-common-chord-6
export default async ({ page, first, log, shot, text }) => {
  log("starting position:", await text("#status"));
  await shot("start");

  await page.click("#bestBtn");
  const best = await text("#status");
  log("best chord:", best);
  if (!/Best chord found/.test(best)) throw new Error("best-chord button did not reach the optimum");
  await page.click("#names"); // the applet's names checkbox starts unchecked
  await shot("best");
  if (!first) return;

  await page.click('input[name="mode"][value="circles"]');
  log("with names, circles mode:", await text("#status"));
  await shot("options");

  const p = page.locator('[role="button"][aria-label^="Point P"]');
  await p.focus();
  await p.press("ArrowRight");
  await p.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after two arrow keys, focus:", focused);
  if (!/^Point P/.test(focused)) throw new Error("keyboard focus left the board");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
