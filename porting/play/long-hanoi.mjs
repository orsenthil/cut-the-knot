// Tower of Hanoi, the Hard Way: a perfect 80-move solve, a refused repeat,
// a two-disk dead end, and a Fast replay of the long solution.
export default async ({ page, first, log, shot, text }) => {
  const pegs = await page.$$(".peg");
  const move = async (a, b) => { await pegs[a].click(); await pegs[b].click(); };

  for (const [a, b] of await page.evaluate(() => LongHanoiCore.solution(4))) await move(a, b);
  log("perfect:", await text("#status"), "|", await text("#scoreLine"));
  await shot("win");
  if (!first) return;

  await page.click("#resetBtn");
  await move(0, 1); await move(1, 0);
  log("repeat refused:", await text("#status"), "|", await text("#scoreLine"));

  await page.click("#resetBtn");
  await page.selectOption("#nInput", "2");
  for (const [a, b] of [[0, 2], [0, 1], [2, 0], [0, 1]]) await move(a, b);
  log("dead end:", await text("#status"));
  await shot("stuck");

  await page.click("#resetBtn");
  await page.selectOption("#nInput", "3");
  await page.click("#fastBtn");
  await page.waitForFunction(() => /Congratulations/.test(document.getElementById("status").textContent), null, { timeout: 60000 });
  log("fast:", await text("#status"));
};
