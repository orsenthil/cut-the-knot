// Water: pour C->B, B->A, A->C, B->A, C->B, B->A to measure 4 in jug B;
// then try an impossible target with sizes 4, 6, 10.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs water
export default async ({ page, first, log, shot, text }) => {
  const pour = (from, to) => page.click(`#pourControls .pour[data-from="${from}"][data-to="${to}"]`);
  log("start:", await text("#status"));

  await pour(2, 1); // (0, 0, 8) -> (0, 5, 3)
  await pour(1, 0); // -> (3, 2, 3)
  await pour(0, 2); // -> (0, 2, 6)
  await pour(1, 0); // -> (2, 0, 6)
  await pour(2, 1); // -> (2, 5, 1)
  await pour(1, 0); // -> (3, 4, 1)
  log("measured 4:", await text("#status"), "| pours:", await text("#moves"));
  await shot("measured");
  if (!first) return;

  await page.click("#newBtn");
  // Two moves made with the keyboard alone: focus a jug, Enter to pick it up,
  // focus another, Enter to pour into it.
  await page.focus('.jug[data-jug="2"]');
  await page.keyboard.press("Enter");
  await page.focus('.jug[data-jug="1"]');
  await page.keyboard.press("Enter");
  log("by keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.className));
  await shot("keyboard");

  await page.check('input[name="mode"][value="capacity"]');
  for (const [id, value] of [["capA", "4"], ["capB", "6"], ["capC", "10"]]) {
    await page.fill(`#${id}`, value);
    await page.dispatchEvent(`#${id}`, "change");
  }
  await page.fill("#targetIn", "5");
  await page.dispatchEvent("#targetIn", "change");
  await pour(2, 1);
  await pour(1, 0);
  log("impossible target:", await text("#status"), "| sizes:", await page.inputValue("#capC"));
  await shot("impossible");
};
