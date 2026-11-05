// Grundy's Game: perfect play wins from 15, a half split is refused, 7 (Grundy 0) loses.
const perfectMove = () => {
  const V = GrundyCore.NIM_VALUE;
  const bars = (document.getElementById("heapsLine").textContent.match(/\d+/g) || []).map(Number);
  const total = bars.reduce((x, s) => x ^ V[s], 0);
  for (const e of document.querySelectorAll(".cut-hit:not(.equal)")) {
    const [, n, a, b] = e.getAttribute("aria-label").match(/of (\d+) into (\d+) and (\d+)/).map(Number);
    if ((total ^ V[n] ^ V[a] ^ V[b]) === 0) return e.getAttribute("aria-label");
  }
  return null;
};
// The board keeps its "busy" class once the game is over, so wait on the status instead.
const notThinking = () => !/Thinking/.test(document.getElementById("status").textContent);

export default async ({ page, first, log, shot, idle, text }) => {
  const over = async () => /won/.test(await text("#status"));
  while (!(await over())) {
    const label = await page.evaluate(perfectMove);
    if (!label) break;
    await page.click(`.cut-hit[aria-label="${label}"]`);
    await idle(notThinking);
  }
  log("perfect play from 15:", await text("#status"));
  await shot("win");
  if (!first) return;
  await page.selectOption("#sizeInput", "8");
  await page.click('.cut-hit[aria-label^="Break the bar of 8 into 4 and 4"]');
  log("half split:", await text("#status"));
  await page.selectOption("#sizeInput", "7");
  while (!(await over())) {
    await page.click(".cut-hit:not(.equal)");
    await idle(notThinking);
  }
  log("from 7:", await text("#status"));
};
