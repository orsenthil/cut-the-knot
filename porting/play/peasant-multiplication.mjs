// Peasant Multiplication: 85 x 18 with binary shown, then four digits.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs peasant-multiplication
export default async ({ page, first, log, shot, text }) => {
  await page.check("#binIn");
  log("85 x 18:", await text("#sum"));
  await shot("binary");
  if (!first) return;
  await page.selectOption("#digitsSel", "4");
  await page.click("#newBtn");
  await page.click('#numA button[aria-label="First number: digit 1 up"]');
  log("four digits:", await text("#status"));
  await shot("four");
};
