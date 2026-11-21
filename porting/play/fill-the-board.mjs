// Filling a grid with good neighbours: a start that gets stuck, then the diagonal, then the other controls.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fill-the-board
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.dataset.x ? `${a.dataset.x},${a.dataset.y}` : a.id); });
  const cell = (x, y) => page.locator(`#grid button[data-x="${x}"][data-y="${y}"]`);
  const filled = () => page.locator("#grid button.chip, #grid button.added").count();
  log("initial:", await text("#info"));
  await shot("initial");
  await page.fill("#nIn", "15"); await page.press("#nIn", "Tab");
  log("N = 15:", await text("#info"), "| squares =", await page.locator("#grid button").count());
  await shot("max-options");
  await page.fill("#nIn", "5"); await page.press("#nIn", "Tab");
  // too few chips: a lonely pair
  await cell(0, 0).click(); await cell(4, 4).click(); await page.check("#playRadio"); await page.click("#stepBtn");
  log("two far-apart chips, one step:", await text("#status"), "| result =", await kind());
  await shot("loss");
  await page.check("#setupRadio");
  log("back to Set up keeps the chips:", await filled(), "| result =", await kind());
  for (const i of [1, 2, 3]) await cell(i, i).click();
  await cell(2, 3).click(); await cell(2, 3).click(); // a second press takes a chip off again
  log("diagonal chips placed:", await text("#info"));
  await page.check("#playRadio");
  for (let i = 0; i < 6 && !(await kind()); i++) await page.click("#stepBtn");
  log("played to the end:", await text("#status"), "| result =", await kind());
  await shot("win");
  if (!first) return;
  await page.check("#setupRadio"); await page.click("#resetBtn");
  log("after Reset:", await filled(), "chips |", await text("#info"));
  await cell(2, 2).focus(); await page.keyboard.press("Enter"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard: two chips placed, focus =", await focus(), "|", await text("#info"));
  await page.fill("#nIn", "16"); await page.press("#nIn", "Tab");
  log("N typed 16:", await text("#status"), "|", await page.inputValue("#nIn"));
  await shot("reset");
};
