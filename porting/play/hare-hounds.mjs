// Hare and Hounds: Expert hounds (by hand, from the solver) beat the computer hare; a random hare-side human loses to Expert hounds.
const notThinking = () => !/Thinking/.test(document.getElementById("status").textContent);
const spots = (page) => page.$$("#board circle.spot");
export default async ({ page, first, log, shot, idle, text }) => {
  const over = async () => /win|escapes/.test(await text("#status"));
  // Win as the hounds with the solver's best moves.
  for (let i = 0; i < 40 && !(await over()); i++) {
    const best = await page.evaluate(() => {
      // Rebuild the state from the page: pieces carry their spot in cx/cy order.
      const POS = [[40, 120]];
      for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) POS.push([140 + c * 100, 30 + r * 90]);
      POS.push([440, 120]);
      const b = new Array(11).fill(0);
      for (const c of document.querySelectorAll("#pieces circle")) {
        const p = POS.findIndex(([x, y]) => x === Number(c.getAttribute("cx")) && y === Number(c.getAttribute("cy")));
        b[p] = c.classList.contains("hound") ? 1 : 2;
      }
      const s = { b, turn: 1, stall: 0, winner: 0, reason: "" };
      return HareHoundsCore.bestMoves(s)[0];
    });
    const sp = await spots(page);
    await sp[best[0]].click();
    await sp[best[1]].click();
    await idle(notThinking);
  }
  log("expert-style hounds vs beginner hare:", await text("#status"));
  await shot("hounds");
  if (!first) return;
  await page.selectOption("#levelInput", "expert");
  await page.selectOption("#sideInput", "2");
  await page.click("#newBtn");
  await idle(notThinking);
  for (let i = 0; i < 60 && !(await over()); i++) {
    const moves = await page.evaluate(() => {
      const POS = [[40, 120]];
      for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) POS.push([140 + c * 100, 30 + r * 90]);
      POS.push([440, 120]);
      const b = new Array(11).fill(0);
      for (const c of document.querySelectorAll("#pieces circle")) {
        const p = POS.findIndex(([x, y]) => x === Number(c.getAttribute("cx")) && y === Number(c.getAttribute("cy")));
        b[p] = c.classList.contains("hound") ? 1 : 2;
      }
      return HareHoundsCore.moves({ b, turn: 2, stall: 0, winner: 0 });
    });
    const [a, t] = moves[Math.floor(Math.random() * moves.length)];
    const sp = await spots(page);
    await sp[a].click();
    await sp[t].click();
    await idle(notThinking);
  }
  log("random hare vs expert hounds:", await text("#status"), "|", await text("#score"));
};
