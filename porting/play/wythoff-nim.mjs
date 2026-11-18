// Wythoff's Nim: with a maximum of 3 the applet always deals two heaps of 3.
// In two-heaps mode the human clears both and wins; in one-heap mode a single
// clear hands the last counter to the computer, which wins.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs wythoff-nim

export default async ({ page, first, log, shot, text }) => {
  const setMax3 = async () => {
    for (let i = 0; i < 12; i++) await page.click("#lessBtn");
  };
  const waitForComputer = () =>
    page.waitForFunction(() => /I won|You won|Your turn|Click a square/.test(
      document.getElementById("status").textContent || ""), null, { timeout: 10000 });

  await setMax3();
  await page.click("#twoHeap");
  log("board:", await page.evaluate(() =>
    [...document.querySelectorAll(".board-label")].map((el) => el.textContent).join(" | ")));

  // ---- a win: remove all three from both heaps at once ----
  await page.click('.square[data-heap="0"][data-index="0"]');
  log("two heaps, took all:", await text("#status"));
  await shot("win");

  if (first) {
    // Every option in both directions.
    await page.click("#moreBtn");
    log("after clicking more:", await text("#maxOut"));
    await page.click("#lessBtn");
    log("after clicking less:", await text("#maxOut"));
    await page.click("#oneHeap");
    log("after choosing one heap:", await page.locator(".board-label").count(), "heaps");
    await page.click("#twoHeap");
    log("after choosing two heaps:", await page.locator(".board-label").count(), "heaps");

    // A keyboard play: focus a square, press Enter, and check the focus after
    // the computer has answered.
    await page.click("#oneHeap");
    await page.focus('.square[data-heap="0"][data-index="2"]');
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
    await waitForComputer();
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.getAttribute("aria-label") || el.tagName : "none";
    });
    log("after a keyboard move, focus is on:", focused);
    await shot("keyboard");
  }

  // ---- a loss: empty one heap, then the computer takes the other ----
  await page.click("#oneHeap");
  await page.click('.square[data-heap="0"][data-index="0"]');
  await page.waitForFunction(() => /I won/.test(document.getElementById("status").textContent || ""), null, { timeout: 10000 });
  log("one heap, took all from one:", await text("#status"));
  await shot("loss");
};
