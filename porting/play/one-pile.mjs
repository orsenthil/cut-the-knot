// One Pile: win with perfect play from an N-position; lose from a P-position;
// then Min=1 Max=45 so the take row is as wide as it gets on a phone.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/.test(document.getElementById("status").textContent);
  const over = async () => /won/i.test(await text("#status"));

  await page.selectOption("#minInput", "3");
  await page.selectOption("#maxInput", "5");

  // Win: deal until the pile is an N-position, then always leave a P.
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.click("#newBtn");
    const nPos = await page.evaluate(() => {
      const n = Number(document.getElementById("pile").textContent);
      return !OnePileCore.isPPosition(n, 3, 5);
    });
    if (!nPos) continue;
    for (let k = 0; k < 40 && !(await over()); k++) {
      const t = await page.evaluate(() => {
        const n = Number(document.getElementById("pile").textContent);
        const s = { n, min: 3, max: 5, turn: "you", over: n < 3, winner: null, history: [] };
        if (s.over) return null;
        return OnePileCore.winningMoves(s)[0] || OnePileCore.legalMoves(s)[0];
      });
      if (t == null) break;
      if (k === 0) {
        await page.locator(`.take[data-take="${t}"]`).focus();
        await page.keyboard.press("Enter");
      } else {
        await page.locator(`.take[data-take="${t}"]`).click();
      }
      await idle(thinking);
    }
    break;
  }
  log("win:", await text("#status"), "|", await text("#score"));
  await shot("win");
  if (!first) return;

  // Loss: deal a P-position and always take the smallest; the computer wins.
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.click("#newBtn");
    const p = await page.evaluate(() => {
      const n = Number(document.getElementById("pile").textContent);
      return OnePileCore.isPPosition(n, 3, 5);
    });
    if (!p) continue;
    for (let k = 0; k < 40 && !(await over()); k++) {
      await page.locator('.take[data-take="3"]').click();
      await idle(thinking);
    }
    break;
  }
  log("loss:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  // Widest take row.
  await page.selectOption("#minInput", "1");
  await page.selectOption("#maxInput", "45");
  await page.click("#newBtn");
  await shot("largest");
};
