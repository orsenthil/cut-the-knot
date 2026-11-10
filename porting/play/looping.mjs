// Looping Chips: a few jumps, home again with the start order, hint on, reset.
// The reverse-order goal is unreachable (see check-looping.mjs).
export default async ({ page, first, log, shot, text }) => {
  const tap = async (sq) => {
    await page.click(`#leftBoard .cell.left[data-sq="${sq}"]`);
  };

  await tap(0); await tap(5); // red jumps +5
  await tap(1); await tap(6); // yellow jumps +5
  log("after two jumps:", await text("#status"), "| moves", await text("#moveNum"));
  await shot("mid");

  if (!first) return;

  await page.click("#hintInput");
  log("hint on");

  await tap(5); await tap(0);
  await tap(6); await tap(1);
  log("home again:", await text("#status"));
  await shot("home");

  await page.click("#resetBtn");
  log("reset moves:", await text("#moveNum"));
};
