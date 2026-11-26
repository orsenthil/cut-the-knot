// Graph and Roots of a Cubic: three real roots, then a complex pair, the
// tangent at the inflection point by a click, the sliders at their ends, a = 0.
// Run with: NODE_PATH=... node porting/play.mjs polynomial-degree-3
export default async ({ page, first, log, shot, text }) => {
  const set = async (n, v) => { await page.fill("#s" + n, String(v)); };
  await set("a", 1); await set("b", -6); await set("c", 11); await set("d", -6);
  log("three real:", await text("#formula"), "|", await text("#info"));
  // Click the inflection point (2, 0) on the canvas.
  const box = await page.locator("#board").boundingBox();
  await page.mouse.click(box.x + ((2 + 14) / 28) * box.width, box.y + box.height / 2);
  log("tangent:", await text("#info"));
  await shot("three real roots, tangent");
  if (!first) return;

  await page.click("#tanBox");
  await set("b", -1); await set("c", 1); await set("d", -1);
  log("complex pair:", await text("#info"));
  await shot("complex pair");
  await set("a", 20); await set("b", -20); await set("c", 20); await set("d", -20);
  log("ends:", await text("#formula"), "|", await text("#info"));
  await set("a", 0);
  log("a = 0:", await text("#info"));
  await page.fill("#yIn", "5000"); await page.dispatchEvent("#yIn", "change");
  log("y range too big:", await page.inputValue("#yIn"));
  await page.focus("#sa"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  log("keyboard:", await text("#formula"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await shot("a = 0.02");
};
