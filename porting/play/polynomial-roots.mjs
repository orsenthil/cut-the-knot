// Graph of a Polynomial Defined by Its Roots: set roots -3, 1, 1 (cross and
// touch), flip A, the largest degree, values outside the ranges, the keyboard.
// Run with: NODE_PATH=... node porting/play.mjs polynomial-roots
export default async ({ page, first, log, shot, text }) => {
  const box = (i) => page.locator("#formula input").nth(i);
  const set = async (i, v) => { await box(i).fill(String(v)); await box(i).dispatchEvent("change"); };
  await set(0, 1); await set(1, -3); await set(2, 1); await set(3, 1);
  log("roots -3, 1, 1:", await text("#info"));
  await shot("cross and touch");
  if (!first) return;
  await set(0, -2);
  log("A = -2:", await text("#info"));
  await page.fill("#degIn", "10"); await page.dispatchEvent("#degIn", "change");
  log("degree 10:", await page.locator("#formula input").count(), "boxes |", await text("#info"));
  await shot("degree 10");
  await page.fill("#degIn", "12"); await page.dispatchEvent("#degIn", "change");
  log("degree 12 asked:", await page.inputValue("#degIn"));
  await page.fill("#degIn", "-1"); await page.dispatchEvent("#degIn", "change");
  log("degree -1 asked:", await page.inputValue("#degIn"), "|", await text("#info"));
  await page.fill("#degIn", "2"); await page.dispatchEvent("#degIn", "change");
  await box(1).focus(); await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  log("keyboard:", await box(1).inputValue(), "|", await text("#info"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await page.click("#newBtn");
  log("new:", await text("#info"));
};
