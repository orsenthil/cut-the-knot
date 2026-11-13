// Marriage Problem: Fast-solve the page example, then a failing odd tridiag.
export default async ({ page, first, log, shot, text }) => {
  const clearOnes = async () => {
    for (;;) {
      const ones = await page.$$("#board .cell.one");
      if (!ones.length) break;
      await ones[0].click();
    }
  };
  const setMatrix = async (m) => {
    await clearOnes();
    const n = m.length;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!m[r][c]) continue;
        const cells = await page.$$("#board .cell");
        await cells[r * n + c].click();
      }
    }
  };

  await page.selectOption("#nInput", "5");
  await setMatrix([
    [1, 0, 0, 0, 1],
    [1, 1, 0, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 1, 1, 0],
    [0, 0, 0, 1, 0],
  ]);
  await page.click("#fastBtn");
  await page.waitForFunction(
    () => /Finished|Failed/.test(document.getElementById("status").textContent),
    null,
    { timeout: 30000 },
  );
  log("example:", await text("#status"), "|", await text("#phase"));
  await shot("win");

  if (!first) return;

  await setMatrix([
    [0, 1, 0, 0, 0],
    [1, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 1],
    [0, 0, 0, 1, 0],
  ]);
  await page.click("#fastBtn");
  await page.waitForFunction(
    () => /Failed/.test(document.getElementById("status").textContent),
    null,
    { timeout: 30000 },
  );
  log("tridiag odd:", await text("#status"));
  await shot("fail");
};
