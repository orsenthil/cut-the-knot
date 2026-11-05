// Tower of Hanoi: a perfect solve by hand, an illegal drop, hints from a messy position, a Fast replay.
export default async ({ page, first, log, shot, text }) => {
  const pegs = await page.$$(".peg");
  const move = async (a, b) => { await pegs[a].click(); await pegs[b].click(); };
  for (const [a, b] of await page.evaluate(() => HanoiCore.solution(4))) await move(a, b);
  log("perfect:", await text("#status"));
  await shot("win");
  if (!first) return;
  await page.click("#resetBtn");
  await move(0, 2); await move(0, 2);
  log("illegal:", await text("#status"));
  await move(0, 1);
  for (let i = 0; i < 30 && !/Congratulations/.test(await text("#status")); i++) await page.click("#hintBtn");
  log("hints from a mess:", await text("#status"), "|", await text("#scoreLine"));
  await page.click("#resetBtn");
  await page.selectOption("#nInput", "3");
  await page.click("#fastBtn");
  await page.waitForFunction(() => /Congratulations/.test(document.getElementById("status").textContent));
  log("fast:", await text("#status"));
};
