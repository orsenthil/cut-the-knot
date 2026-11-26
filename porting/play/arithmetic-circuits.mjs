// Build an Arithmetic Circuit: x⁸ in 3 gates (a win), then x² − y² two
// ways (both par), then the 2 x 2 permanent.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs arithmetic-circuits
export default async ({ page, first, log, shot, text }) => {
  const gate = async (a, op, b) => { await page.selectOption("#aIn", { index: a }); await page.selectOption("#opIn", op); await page.selectOption("#bIn", { index: b }); await page.click("#addBtn"); };
  await page.selectOption("#puzzleIn", "x8");
  await gate(1, "*", 1); await gate(2, "*", 2); await gate(3, "*", 3);
  log("x^8:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("x8");
  if (!first) return;
  await page.selectOption("#puzzleIn", "diff");
  await gate(1, "*", 1); await gate(2, "*", 2); await gate(3, "-", 4);
  log("x^2 - y^2 as x·x − y·y:", await text("#status"));
  await page.click("#resetBtn");
  await gate(1, "+", 2); await gate(1, "-", 2); await gate(3, "*", 4);
  log("factored:", await text("#status"));
  await page.selectOption("#puzzleIn", "perm2");
  await gate(1, "*", 4); await gate(2, "*", 3); await gate(5, "+", 6);
  log("perm2:", await text("#status"));
  await shot("perm2");
};
