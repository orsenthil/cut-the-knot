// Polygonal Numbers: the start picture, then the largest (20 sides, size 15),
// then values outside the ranges in both directions.
// Run with: NODE_PATH=... node porting/play.mjs polygonal-numbers
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("start");
  if (!first) return;
  const set = async (id, v) => { await page.fill(id, String(v)); await page.dispatchEvent(id, "change"); };
  await set("#sides", 6); await set("#size", 2);
  log("hexagon:", await text("#readout"));
  await set("#sides", 3); await set("#size", 4);
  log("triangle:", await text("#readout"));
  await set("#sides", 20); await set("#size", 15);
  log("largest:", await text("#readout"));
  await shot("largest");
  await set("#sides", 2); await set("#size", 99);
  log("out of range:", await page.inputValue("#sides"), await page.inputValue("#size"), await text("#readout"));
  await page.keyboard.press("Tab");
  await page.focus("#sides"); await page.keyboard.press("ArrowUp");
  log("keyboard:", await page.inputValue("#sides"), await text("#readout"));
};
