// Graph and Roots of a Quadratic Polynomial: two real roots, a double root,
// a complex pair on its circle, a < 0, a = 0, the sliders' ends, the keyboard.
// Run with: NODE_PATH=... node porting/play.mjs quadratic-polynomial
export default async ({ page, first, log, shot, text }) => {
  const set = async (n, v) => { await page.fill("#s" + n, String(v)); };
  await set("a", 1); await set("b", 1); await set("c", -6);
  log("x² + x − 6:", await text("#formula"), "|", await text("#info"));
  await shot("two real roots");
  if (!first) return;
  await set("b", -4); await set("c", 4);
  log("double:", await text("#info"));
  await set("b", 2); await set("c", 4);
  log("complex:", await text("#info"));
  await shot("complex pair");
  await set("a", -1);
  log("a < 0:", await text("#info"));
  await set("a", 0);
  log("a = 0:", await text("#info"));
  await set("b", 0);
  log("a = b = 0:", await text("#info"));
  await set("a", 10); await set("b", -10); await set("c", 10);
  log("ends:", await text("#formula"), "|", await text("#info"));
  await page.focus("#sb"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  log("keyboard:", await text("#formula"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.fill("#xIn", "0"); await page.dispatchEvent("#xIn", "change");
  log("x range 0:", await page.inputValue("#xIn"));
  await page.click("#newBtn");
  log("new:", await text("#formula"));
};
