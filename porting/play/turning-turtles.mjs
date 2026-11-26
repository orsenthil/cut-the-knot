// Turning Turtles: play the Nim strategy to a win from a fixed row, then
// let the computer win, keyboard, Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs turning-turtles
export default async ({ page, first, log, shot, text }) => {
  const sq = (i) => `#row .sq[data-i="${i}"]`;
  const nimMove = () => page.evaluate(() => {
    const x = [...document.querySelectorAll("#row .sq")].map((b) => b.classList.contains("x"));
    const s = x.reduce((a, v, i) => (v ? a : a ^ (i + 1)), 0);
    if (!s) { const i = x.indexOf(false); return [i, null]; }
    let L = 0; x.forEach((v, i) => { if (!v && ((i + 1) ^ s) < i + 1) L = i + 1; });
    return [L - 1, L === s ? null : (L ^ s) - 1];
  });
  const playOut = async (smart) => {
    for (let k = 0; k < 40; k++) {
      if (await page.evaluate(() => /won/i.test(document.getElementById("status").textContent))) return;
      const [i, j] = smart ? await nimMove() : await page.evaluate(() => [[...document.querySelectorAll("#row .sq")].findIndex((b) => !b.classList.contains("x")), null]);
      await page.click(sq(i));
      if (j !== null) await page.click(sq(j));
      await page.click("#moveBtn");
      await page.waitForFunction(() => !document.getElementById("moveBtn").disabled || /won/i.test(document.getElementById("status").textContent) || document.querySelector("#row .sq.pick") === null && !document.querySelector("#row .sq:disabled"), null, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  };
  // Make sure the first row is a win for the mover: reset until the Nim-sum is not 0
  for (let k = 0; k < 20; k++) {
    const s = await page.evaluate(() => [...document.querySelectorAll("#row .sq")].reduce((a, b, i) => (b.classList.contains("x") ? a : a ^ (i + 1)), 0));
    if (s) break;
    await page.click("#resetBtn");
  }
  await playOut(true);
  log("nim play:", await text("#status"), "| class:", await page.getAttribute("#status", "class"), "|", await text("#score"));
  await shot("won");
  if (!first) return;
  await page.click("#resetBtn");
  await playOut(false);
  log("naive play:", await text("#status"), "|", await text("#score"));
  await page.click("#resetBtn");
  const o = await page.evaluate(() => [...document.querySelectorAll("#row .sq")].findIndex((b) => !b.classList.contains("x")));
  await page.focus(sq(o)); await page.keyboard.press("Enter");
  log("keyboard pick:", await text("#status"));
  await shot("picked");
};
