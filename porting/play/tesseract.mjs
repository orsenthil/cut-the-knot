// The Tesseract: build it step by step, turn it, show the section and the
// hyperplane sliders; then solve the reper puzzle round an edge, and try
// Back, Repeat, Reset by keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs tesseract
export default async ({ page, first, log, shot, text }) => {
  for (let k = 0; k < 5; k++) { await page.click("#goBtn"); await page.waitForTimeout(1100); log("step:", await text("#stepText")); }
  await page.locator('#sliders input').nth(3).fill("80");
  await page.check("#sectionBox");
  await shot("tesseract");
  // Puzzle: go round one edge of the fixed square
  const fixed = (await text("#here")).match(/Fixed reper on (\S+);/)[1];
  // the two squares sharing an edge: pick a free axis f fixed at 0 and the two fixed axes
  const L = "XYZH";
  const free = [...fixed].map((c, i) => (L.includes(c) ? i : -1)).filter((i) => i >= 0);
  const f = free[0], g = free[1];
  const fixedAxes = [0, 1, 2, 3].filter((i) => !free.includes(i));
  const name = (freeAxes, vals) => [0, 1, 2, 3].map((i) => (freeAxes.includes(i) ? L[i] : String(vals[i]))).join("");
  const vals = {}; fixedAxes.forEach((i) => (vals[i] = Number(fixed[i])));
  const a = name([g, fixedAxes[0]], { ...vals, [f]: 0 }), b = name([g, fixedAxes[1]], { ...vals, [f]: 0 });
  for (const n of [a, b, fixed]) { await page.click(`#dest button[data-name="${n}"]`); log(`to ${n}:`, await text("#status")); }
  log("class:", await page.getAttribute("#status", "class"));
  await shot("reversed");
  if (!first) return;
  await page.check('input[value="plane"]');
  await page.locator('#sliders input').nth(4).fill("0.5");
  log("hyperplane E = 0.5 shown");
  await page.click("#backBtn");
  log("back:", await text("#status"));
  await page.focus("#repeatBtn"); await page.keyboard.press("Enter");
  log("repeat:", await text("#here"));
  await page.focus("#dest button"); await page.keyboard.press("Enter");
  log("keyboard move:", await text("#here"), "| focus:", await page.evaluate(() => document.activeElement.textContent));
  await page.check("#pathBox");
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
