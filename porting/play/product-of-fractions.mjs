// Product of Simple Fractions: 2/3 x 3/4, Simplify, the numerator/denominator
// fix-ups, the largest values, the keyboard.
// Run with: NODE_PATH=... node porting/play.mjs product-of-fractions
export default async ({ page, first, log, shot, text }) => {
  const set = async (id, v) => { await page.fill(id, String(v)); await page.dispatchEvent(id, "change"); };
  await set("#pIn", 1); await set("#rIn", 1);
  await set("#qIn", 3); await set("#pIn", 2); await set("#sIn", 4); await set("#rIn", 3);
  log("2/3 x 3/4:", await text("#prod"), "|", await text("#reduced"), "|", await text("#info"));
  await shot("2/3 x 3/4");
  if (!first) return;
  await page.click("#simplifyBtn");
  log("simplified:", await page.inputValue("#pIn"), "/", await page.inputValue("#qIn"), "x", await page.inputValue("#rIn"), "/", await page.inputValue("#sIn"));
  await set("#pIn", 9);
  log("p raised past q:", await page.inputValue("#pIn"), "/", await page.inputValue("#qIn"));
  await set("#qIn", 1);
  log("q lowered below p:", await page.inputValue("#pIn"), "/", await page.inputValue("#qIn"));
  await set("#sIn", 150); await set("#rIn", 0);
  log("s 150, r 0:", await page.inputValue("#rIn"), "/", await page.inputValue("#sIn"));
  await set("#qIn", 99); await set("#pIn", 50); await set("#rIn", 33);
  log("largest:", await text("#prod"));
  await shot("largest");
  await page.focus("#pIn"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Tab");
  log("keyboard:", await page.inputValue("#pIn"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
};
