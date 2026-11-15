// Odd Scoring: a win on 3 steps by keyboard; a loss on 1 step; a full game on
// 11 steps with the winning move each time; then the longest band on a phone.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/.test(document.getElementById("status").textContent);

  // Win: 3 steps. Take 2 with the keyboard; the computer must take the last one.
  await page.selectOption("#stepsInput", "3");
  await page.locator('.target[data-step="2"]').focus();
  await page.keyboard.press("Enter");
  await idle(thinking);
  log("3 steps, take 2 by keyboard:", await text("#status"), "|", await text("#score"));
  await shot("win");

  if (!first) return;

  // Loss: 1 step. The only move makes your total odd.
  await page.selectOption("#stepsInput", "1");
  await page.locator(".target").click();
  log("1 step:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  // 11 steps, always a winning move (from the core), with the Forward hint.
  await page.selectOption("#stepsInput", "11");
  await page.selectOption("#hintInput", "forward");
  for (let n = 0; n < 12 && !/won/i.test(await text("#status")); n++) {
    const d = await page.evaluate(() => {
      const t = document.getElementById("tally").textContent.match(/\d+/g).map(Number);
      const s = { steps: 11, you: t[0], computer: t[1], left: t[2], turn: "you", over: false, winner: null };
      return OddScoringCore.winningMoves(s)[0] || 1;
    });
    if (n === 1) { // one move with the number keys
      await page.locator(".target").first().focus();
      await page.keyboard.press(String(d));
    } else await page.locator(`.target[data-step="${d}"]`).click();
    if (n === 0) { await idle(thinking); await shot("reply"); }
    await idle(thinking);
  }
  log("11 steps, perfect play:", await text("#status"), "|", await text("#score"));

  // The longest band, with the Modular hint.
  await page.selectOption("#stepsInput", "25");
  await page.selectOption("#hintInput", "modular");
  await shot("longest");
};
