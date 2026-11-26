// Permanent from a Determinant: 2 x 2 with a minus on b (a win), then the
// best 3 x 3 (5 of 6), keyboard, other numbers in Grenet's matrix.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs perm-from-det
export default async ({ page, first, log, shot, text }) => {
  await page.check('input[name="size"][value="2"]');
  await page.click('#grid [data-k="1"]');
  log("2 x 2:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  log("grenet 3 x 3:", await text("#tryOut"));
  await shot("two");
  if (!first) return;
  await page.check('input[name="size"][value="3"]');
  await page.click('#grid [data-k="0"]');
  log("3 x 3, minus on a:", await text("#status"));
  await page.click('#grid [data-k="0"]');
  // a best pattern: minus signs on b, d (5 positive)
  const best = await page.evaluate(() => { for (let m = 0; m < 512; m++) { const s = PermFromDetCore.start({ n: 3, signs: Array.from({ length: 9 }, (_, k) => ((m >> k) & 1 ? -1 : 1)) }); if (PermFromDetCore.positives(s) === 5) return s.signs; } });
  for (let k = 0; k < 9; k++) if (best[k] < 0) await page.click(`#grid [data-k="${k}"]`);
  log("best 3 x 3:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await page.focus('#grid [data-k="4"]'); await page.keyboard.press("Enter");
  log("keyboard:", await text("#status"));
  await page.click("#tryBtn");
  log("other numbers:", await text("#tryOut"));
  await shot("three");
};
