// Up And Down: the visible part, one revealed hidden card, the hidden run, training.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs up-and-down
export default async ({ page, first, log, shot, text }) => {
  log("at the start:", await text("#status"));
  await shot("visible");

  const blanks = await page.locator("#board .card.blank").count();
  log("blank cards:", blanks);
  await page.locator("#board .card.blank").first().click();
  log("after a reveal:", await text("#status"), "|", await page.getAttribute("#status", "class"));
  await shot("revealed");

  await page.click("#hiddenBtn");
  log("hidden part:", await text("#status"));
  await shot("hidden");
  if (!first) return; // the dark run has the screenshots above as well

  await page.click("#allBtn");
  log("whole permutation:", await text("#status"));
  await shot("all");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.check("#trainingIn");
  log("training:", await text("#status"), "| cards:", await page.locator("#board .card").count());
  await shot("training");
};
