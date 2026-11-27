// Fifteen: two configurations in both themes — a shuffled 4x4 Loyd's board
// and a Cheated 6x6 Cylinder board. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs fifteen
export default async ({ page, first, log, shot, text }) => {
  const boardSize = async () => parseInt(await text("#size"), 10);
  const setSize = async (n) => {
    for (let guard = 0; guard < 8 && (await boardSize()) < n; guard++) await page.click("#moreBtn");
    for (let guard = 0; guard < 8 && (await boardSize()) > n; guard++) await page.click("#lessBtn");
  };

  // Configuration 1: the classic board after the applet's Shuffle button.
  await page.click("#shuffleBtn");
  log("shuffled:", await text("#status"));
  await shot("loyd-shuffle");

  if (first) {
    // Every control, in the order a player would meet it, in both directions.
    await setSize(3);
    if (!(await page.locator("#lessBtn").isDisabled())) throw new Error("less should stop at 3");
    await setSize(7);
    if (!(await page.locator("#moreBtn").isDisabled())) throw new Error("more should stop at 7");
    if (!(await page.locator("#cyclesBox").isDisabled())) throw new Error("cycles should stop at 7");
    await setSize(4);
    for (const mode of ["1", "2", "0"]) await page.selectOption("#mode", mode);
    await page.locator("#cyclesBox").check();
    log("cycles:", await text("#cyclesOut"));
    await page.locator("#cyclesBox").uncheck();
    await page.click("#cheatBtn");
    log("cheated 4x4:", await text("#status"));
    await page.click("#newBtn");
    log("reset:", await text("#status"));

    // Two keyboard-only moves; focus must stay on the board cursor.
    await page.focus(".cursor-dot");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    const focused = await page.evaluate(() => document.activeElement?.classList.contains("cursor-dot"));
    if (!focused) throw new Error("the board cursor lost focus after the slides");
    log("keyboard:", await text("#status"));
    await setSize(4);
    await page.selectOption("#mode", "0");
  }

  // Configuration 2: Cylinder at 6x6, where Cheat again reaches an
  // unreachable parity class. The wrapping menu and the largest size are both
  // visible at phone width here.
  await page.selectOption("#mode", "1");
  await setSize(6);
  await page.click("#cheatBtn");
  log("cylinder cheat:", await text("#status"));
  await shot("cylinder-cheat");
};
