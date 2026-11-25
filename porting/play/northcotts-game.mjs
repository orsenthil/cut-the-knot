// Northcott's Game: play the good moves to win from a winning start, then lose on purpose.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs northcotts-game
export default async ({ page, first, log, shot, idle, text }) => {
  // the player has a winning move when the nim-sum of the gaps is not 0: take it every time
  for (let tries = 0; tries < 12; tries++) {
    await page.click("#newBtn");
    await page.click("#hintBtn");
    const hint = await text("#status");
    if (hint.startsWith("Try this")) break;
  }
  log("a start with a winning move:", await text("#status"));
  await shot("start");
  for (let i = 0; i < 400; i++) {
    const st = await text("#status");
    if (/won/.test(st)) break;
    if (await page.locator("#hintBtn").isDisabled()) { await page.waitForTimeout(500); continue; }
    await page.click("#hintBtn");
    const msg = await text("#status");
    const m = msg.match(/row (\d+) to column (\d+)/);
    if (m) {
      await page.locator("#board .cell.target").nth(0).count();
      const idx = (Number(m[1]) - 1) * 11 + (Number(m[2]) - 1);
      await page.locator("#board .cell").nth(idx).click();
    } else {
      // nothing to take back: slide the first movable checker one square
      await page.locator("#board .cell.mine").first().click();
      await page.locator("#board .cell.target").first().click();
    }
    await page.waitForTimeout(700);
  }
  log("after the game:", await text("#status"));
  await shot("end");
};
