// Lights Out: build a solvable board, hint-solve to a win; then show unsolvable.
export default async ({ page, first, log, shot, text }) => {
  const cells = () => page.$$("#board .cell");
  const allOff = async () => {
    await page.evaluate(() => {
      const real = Math.random;
      Math.random = () => 0;
      document.getElementById("resetBtn").click();
      Math.random = real;
    });
  };

  // All-off, then light the centre (solvable).
  await allOff();
  await page.check("#setupInput");
  let btns = await cells();
  await btns[12].click(); // (2,2)
  await page.uncheck("#setupInput");

  await page.check("#hintInput");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("#board .cell.press").length > 0 ||
      /No solution/i.test(document.getElementById("status").textContent),
  );
  log("hint:", await text("#status"));
  const toPress = await page.$$eval("#board .cell", (els) =>
    els.map((el, i) => (el.classList.contains("press") ? i : -1)).filter((i) => i >= 0),
  );
  await page.uncheck("#hintInput");
  for (const i of toPress) {
    btns = await cells();
    await btns[i].click();
  }
  log("win:", await text("#status"));
  await shot("win");

  if (!first) return;

  // Corner alone is unsolvable.
  await allOff();
  await page.check("#setupInput");
  btns = await cells();
  await btns[0].click();
  await page.uncheck("#setupInput");
  await page.check("#hintInput");
  await page.waitForFunction(
    () => /No solution/i.test(document.getElementById("status").textContent),
  );
  log("unsolvable:", await text("#status"));
  await shot("unsolvable");
};
