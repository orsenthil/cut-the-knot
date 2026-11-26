// Pythagorean Triples Calculator: 3-4-5, a non-primitive triple, the N > M
// fix-ups, N = M, the largest values, the keyboard.
// Run with: NODE_PATH=... node porting/play.mjs pyth-triple-calculator
export default async ({ page, first, log, shot, text }) => {
  const set = async (id, v) => { await page.fill(id, String(v)); await page.dispatchEvent(id, "change"); };
  log("start:", await text("#sum"), "|", await text("#prim"));
  await shot("3, 4, 5");
  if (!first) return;
  await set("#nIn", 3); await set("#mIn", 1);
  log("N 3, M 1:", await text("#sum"), "|", await text("#prim"));
  await set("#mIn", 5);
  log("M raised to 5:", await page.inputValue("#nIn"), await page.inputValue("#mIn"), "|", await text("#sum"));
  await set("#nIn", 2);
  log("N lowered to 2:", await page.inputValue("#nIn"), await page.inputValue("#mIn"));
  await set("#nIn", 1);
  log("N = M = 1:", await page.inputValue("#nIn"), await page.inputValue("#mIn"), "|", await text("#sum"));
  await set("#nIn", 1000); await set("#mIn", 999); await set("#kIn", 1000);
  log("largest:", await text("#sum"), "|", await text("#prim"));
  await shot("largest");
  await set("#kIn", 0);
  log("k 0:", await page.inputValue("#kIn"));
  await page.focus("#nIn"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Tab");
  log("keyboard:", await page.inputValue("#nIn"), await page.inputValue("#mIn"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.click("#lengthsBox");
  log("lengths off:", await page.locator("#pic text").count());
};
