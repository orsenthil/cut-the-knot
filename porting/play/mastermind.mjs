// Mastermind: win with a known secret, then lose by exhausting rows.
export default async ({ page, first, log, shot, text }) => {
  const setPegs = async (colors) => {
    for (let i = 0; i < colors.length; i++) {
      // Re-query after each click: the board re-renders and detaches pegs.
      const pegs = await page.$$("#board .row.active .peg");
      const want = colors[i];
      // empty (-1) → first click sets 0; further clicks cycle.
      for (let k = 0; k <= want; k++) {
        const live = await page.$$("#board .row.active .peg");
        await live[i].click();
      }
    }
  };

  await page.selectOption("#pegsInput", "2");
  await page.selectOption("#colorsInput", "2");

  // Secret [0,0]: Math.random always 0 → floor(0 * 2) = 0 for each peg.
  await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0;
    document.getElementById("resetBtn").click();
    Math.random = real;
  });
  await setPegs([0, 0]);
  await page.click("#submitBtn");
  log("win:", await text("#status"));
  await shot("win");

  if (!first) return;

  // Secret [1,1]: Math.random → 0.99 → floor(0.99 * 2) = 1.
  // Rows = 2+2-1 = 3; three wrong [0,0] guesses lose.
  await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    document.getElementById("resetBtn").click();
    Math.random = real;
  });
  for (let g = 0; g < 3; g++) {
    await setPegs([0, 0]);
    await page.click("#submitBtn");
  }
  log("lose:", await text("#status"));
  await shot("lose");
};
