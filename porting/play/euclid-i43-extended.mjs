// Euclid I.43 Extended: show the same construction with X on each side of BD.
// This is an illustration, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euclid-i43-extended
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: X below BD (inside ABD), both orange pieces and the
  // article's proof lines shown. The blue piece is the larger one.
  await page.click("#abdBtn");
  await page.click("#sameSide");
  await page.click("#proof");
  log("X below BD:", await text("#status"));
  await shot("below-bd");

  // Configuration 2: X above BD (inside BCD), proof lines off. The red piece
  // is now the larger one, but the same orange pairs still match.
  await page.click("#bcdBtn");
  await page.click("#proof");
  log("X above BD:", await text("#status"));
  await shot("above-bd");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: the focus must stay on X after the redraw.
  const xHandle = page.locator('#board [aria-label^="Point X"]');
  await xHandle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#names");
  log("names hidden:", await text("#status"));
  await page.click("#names");
  await page.click("#sameSide");
  await page.click("#bcdBtn");
  await page.click("#abdBtn");
  await page.click("#newBtn");
  log("after New diagram:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset diagram:", await text("#status"));
};
