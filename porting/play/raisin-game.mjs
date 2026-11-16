// Candy Squares: win from an even heap with perfect odd-splits; lose from (3,3);
// You start; largest max; keyboard cut.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/i.test(document.getElementById("status").textContent);
  const over = async () => /won/i.test(await text("#status"));

  await page.uncheck("#randomInput");
  await page.selectOption("#maxInput", "8");
  // Fixed heaps via re-deal until one is even and not (1,*).
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.click("#newBtn");
    // Both 8 — even. Always cut first heap into 1+7? Better: cut into 3+5 (two odds).
    break;
  }

  // Win: keep leaving both-odd.
  for (let k = 0; k < 40 && !(await over()); k++) {
    const cut = await page.evaluate(() => {
      const heaps = [...document.querySelectorAll(".heap-label")].map((el) => {
        const m = /Heap of (\d+)/.exec(el.textContent);
        return m ? Number(m[1]) : 0;
      });
      const state = RaisinGameCore.start({ heaps, random: false });
      const wins = RaisinGameCore.winningMoves(state);
      if (wins.length) return wins[0];
      const any = RaisinGameCore.legalMoves(state)[0];
      return any || null;
    });
    if (!cut) break;
    const btn = page.locator(`.cut[data-which="${cut.which}"][data-k="${cut.k}"]`);
    if (k < 2) {
      await btn.focus();
      await page.keyboard.press("Enter");
      await idle(thinking);
      if (k === 0 && !(await over())) {
        log("focus after computer:", await page.evaluate(() => document.activeElement && (document.activeElement.getAttribute("aria-label") || document.activeElement.id)));
      }
    } else {
      await btn.click();
      await idle(thinking);
    }
  }
  log("win:", await text("#status"), "|", await text("#score"));
  await shot("win");
  if (!first) return;

  // Loss: [5,5] is both odd — any human move loses against the computer's replies.
  await page.selectOption("#maxInput", "5");
  await page.uncheck("#randomInput");
  await page.click("#newBtn");
  for (let k = 0; k < 40 && !(await over()); k++) {
    const btn = page.locator(".cut:not(:disabled)").first();
    if (!(await btn.count())) break;
    await btn.click();
    await idle(thinking);
  }
  log("loss:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  await page.selectOption("#maxInput", "30");
  await page.check("#randomInput");
  await page.click("#newBtn");
  await shot("largest");
};
