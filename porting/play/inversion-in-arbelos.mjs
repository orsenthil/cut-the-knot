// Inversion In Arbelos: two configurations of the illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inversion-in-arbelos
export default async ({ page, log, shot, text }) => {
  // Configuration 1: the applet's start, then five circles with guides on.
  for (let i = 0; i < 4; i++) await page.click("#moreBtn");
  await page.click("#hintChk");
  log("five circles:", await text("#status"));
  await shot("five-circles");

  // Configuration 2: move A and O with the keyboard alone; focus must stay on
  // the board handle, and the chain and status line must follow.
  const a = page.locator('[aria-label^="Point A,"]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const o = page.locator('[aria-label^="Point O,"]');
  await o.focus();
  await page.keyboard.press("ArrowLeft");
  log("after keyboard drags:", await text("#status"));
  log("focus:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  await shot("moved-points");

  // Press every remaining control in player order, both directions.
  await page.click("#lessBtn");
  await page.fill("#nInput", "50");
  await page.locator("#nInput").press("Enter");
  await page.click("#lessBtn");
  await page.fill("#nInput", "1");
  await page.locator("#nInput").press("Enter");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
