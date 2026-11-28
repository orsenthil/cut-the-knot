// Two configurations of Homothety: a single stretched pentagon, then three
// homotheties applied to two triangles with rays and the product shown.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs homothety
export default async ({ page, first, log, shot, text }) => {
  await page.fill("#sidesInput", "5");
  await page.click("#addBtn");
  if (first) log("one homothety:", await text("#status"));
  await shot("one-homothety");

  await page.fill("#countInput", "3");
  await page.click("#countBtn");
  await page.fill("#sidesInput", "3");
  await page.click("#addBtn");
  await page.click("#addBtn");
  await page.click("#linesChk");
  await page.click("#productChk");

  // Keyboard-only change of the first coefficient, to check that focus and
  // the redraw survive a move.
  const firstV = page.locator('circle[aria-label*="Blue point V of homothety 1"]').first();
  await firstV.focus();
  await firstV.press("ArrowRight");
  await firstV.press("Shift+ArrowLeft");
  if (first) {
    log("three homotheties:", await text("#status"));
    log("focus after keyboard moves:", await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName));
  }
  await shot("three-homotheties");
};
