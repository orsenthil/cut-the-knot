// Math Telepathy: 5238 - 3825 = 1413? use 7263 -> 3627: 7263 - 3627 = 3636; circle the first 6, give 3,3,6.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs math-telepathy
export default async ({ page, first, log, shot, text }) => {
  const press = async (d) => page.locator("#pad button").nth(d).click();
  log("start:", (await text("#lines")).slice(0, 40));
  await shot("instructions");
  for (const d of [3, 3, 6]) await press(d);   // difference 3636, the second 6 kept in mind... digits 3,3,6 given
  log("digits:", await text("#given"));
  await page.click("#guessBtn");
  log("guess:", (await text("#answer")).replace(/\s+/g, " "), "|", await text("#status"));
  await shot("guess");
  if (!first) return;
  await page.click("#backBtn");
  log("after take back:", await text("#given"), "| answer cleared:", (await text("#answer")) === "");
  await page.click("#backBtn"); await page.click("#backBtn");
  log("all taken back, button disabled:", await page.locator("#backBtn").isDisabled());
  await press(9); await page.click("#guessBtn");
  log("one digit 9:", (await text("#answer")).replace(/\s+/g, " "));
  await page.click("#resetBtn");
  log("after reset:", (await text("#given")) === "", "instructions back:", await page.locator("#lines").isVisible());
};
