// Pigeon Checkers: make a jump, toggle hint, try a larger N.
export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#nInput", "3");
  await idle();
  // N=3: (0,1) jumps over (1,1) to (2,1).
  await page.click('.cell[data-x="0"][data-y="1"]');
  await page.click('.cell[data-x="2"][data-y="1"]');
  log("after a jump:", await text("#pegLine"));
  await page.check("#hintChk");
  await shot("hint");

  if (!first) return;

  await page.click("#undoBtn");
  log("after Take Back:", await text("#pegLine"));
  await page.selectOption("#nInput", "8");
  await idle();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await shot("large");
  await page.click("#resetBtn");
  log("status:", await text("#status"));
};
