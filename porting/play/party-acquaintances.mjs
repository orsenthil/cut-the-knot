// Party Acquaintances: the round table on 5 (no triangle), then 6 people
// until a triangle, Remove last, keyboard, manual colours, 20 people.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs party-acquaintances
export default async ({ page, first, log, shot, text }) => {
  const node = (i) => `#board .node[data-i="${i}"]`;
  const line = async (a, b) => { await page.click(node(a)); await page.click(node(b)); };
  await page.fill("#nIn", "5"); await page.dispatchEvent("#nIn", "change");
  await page.uncheck("#autoBox");
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]]) await line(a, b);
  await page.check('input[name="colour"][value="blue"]');
  for (const [a, b] of [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]]) await line(a, b);
  log("round table on 5:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("five");
  if (!first) return;
  await page.fill("#nIn", "6"); await page.dispatchEvent("#nIn", "change");
  await page.check("#autoBox");
  const order = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4], [2, 4], [3, 4], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5]];
  for (const [a, b] of order) { await line(a, b); if (await page.evaluate(() => document.getElementById("status").classList.contains("done"))) break; }
  log("six, autocolor:", await text("#status"));
  await shot("six");
  await page.click("#removeBtn");
  log("remove last:", await text("#status"));
  await page.focus(node(0));
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard line:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.i));
  await page.fill("#nIn", "20"); await page.fill("#redIn", "5"); await page.fill("#blueIn", "5"); await page.click("#resetBtn");
  log("20 people, 5 and 5:", await text("#status"));
  await shot("twenty");
};
