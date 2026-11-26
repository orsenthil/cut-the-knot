// Determinant and Permanent: swap to the best permanent (a win), then the
// determinant goal, keyboard swaps, a product's cells lit.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs det-and-perm
export default async ({ page, first, log, shot, text }) => {
  const cell = (k) => `#grid .cell[data-k="${k}"]`;
  const arrange = async (target) => {
    for (let k = 0; k < 9; k++) {
      const cur = await page.evaluate(() => [...document.querySelectorAll("#grid .cell")].map((b) => Number(b.textContent)));
      const j = cur.indexOf(target[k]);
      if (j !== k) { await page.click(cell(k)); await page.click(cell(j)); }
    }
  };
  log("start:", await text("#totals"));
  await arrange([1, 4, 9, 6, 7, 3, 8, 5, 2]);
  log("best permanent:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await page.hover("#terms li:first-child");
  await shot("perm");
  if (!first) return;
  await page.check('input[name="goal"][value="det"]');
  await page.click("#resetBtn");
  await arrange([1, 4, 8, 7, 2, 6, 5, 9, 3]);
  log("best determinant:", await text("#status"));
  await page.focus(cell(0)); await page.keyboard.press("Enter"); await page.focus(cell(1)); await page.keyboard.press("Enter");
  log("keyboard swap:", await text("#status"));
  await shot("det");
};
