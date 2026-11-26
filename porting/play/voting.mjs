// Voting: reveal all three plurality and Borda scores, press through the
// elimination rounds, compare every pair, then try the largest and smallest
// schedules and edit a ballot with the keyboard alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs voting
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  for (const name of ["A", "B", "C"]) {
    await page.selectOption("#pickIn", name);
    await page.click("#revealBtn");
  }
  log("plurality:", await text("#status"));
  await shot("plurality");
  if (!first) return; // the dark run only needs the screenshot above

  await page.selectOption("#methodIn", "borda");
  for (const name of ["A", "B", "C"]) {
    await page.selectOption("#pickIn", name);
    await page.click("#revealBtn");
  }
  log("borda:", await text("#status"));

  await page.selectOption("#methodIn", "elimination");
  await page.click("#elimBtn");
  log("round 1:", await text("#status"), "| button:", await text("#elimBtn"));
  await page.click("#elimBtn");
  log("elimination:", await text("#status"), "| button:", await text("#elimBtn"));
  await shot("elimination");

  await page.selectOption("#methodIn", "pairwise");
  for (const [a, b] of [["A", "B"], ["A", "C"], ["B", "C"]]) {
    await page.selectOption("#pairA", a);
    await page.selectOption("#pairB", b);
    await page.click("#compareBtn");
  }
  log("pairwise:", await text("#status"));
  await shot("pairwise");

  for (let i = 0; i < 38; i++) { await page.click("#candMore"); await page.click("#ballotMore"); }
  log("largest:", await text("#candOut"), "candidates,", await text("#ballotOut"), "ballots");
  await shot("largest");
  for (let i = 0; i < 38; i++) { await page.click("#candLess"); await page.click("#ballotLess"); }
  log("smallest:", await text("#candOut"), "candidates,", await text("#ballotOut"), "ballots,", await text("#status"));
  await shot("smallest");

  await page.focus('button[data-name="B"][data-ballot="1"]');
  await page.keyboard.press("ArrowUp");
  log("keyboard move:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await page.click("#newBtn");
  log("reset:", await text("#candOut"), await text("#ballotOut"), "|", await text("#status"));
};
