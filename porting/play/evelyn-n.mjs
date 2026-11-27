// Evelyn N: two configurations of the circle chain, with screenshots.
// There is no win or loss here; exploring the picture finishes the play.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs evelyn-n
export default async ({ page, first, log, shot, text }) => {
  const setSides = async (want) => {
    while (Number(await text("#nValue")) < want) await page.click("#nPlus");
    while (Number(await text("#nValue")) > want) await page.click("#nMinus");
  };
  const drag = async (selector, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const h = await page.locator(selector).boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 10 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("triangle");

  if (first) {
    // Keyboard alone, with focus still on the corner after the redraw.
    await page.locator('[aria-label^="Corner 1."]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    log("focus after keyboard:", await page.evaluate(() =>
      document.activeElement && document.activeElement.getAttribute("aria-label")));
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press every button in a player's order and change both options both ways.
    await page.click("#whichMinus");
    await page.click("#whichPlus");
    await page.click("#resetBtn");
    while (!(await page.locator("#nMinus").isDisabled())) await page.click("#nMinus");
    log("N at minimum:", await text("#nValue"));
    while (!(await page.locator("#nPlus").isDisabled())) await page.click("#nPlus");
    log("N at maximum:", await text("#nValue"));
    await shot("max-sides");
    await page.fill("#whichInput", "0");
    log("pair at minimum:", await page.inputValue("#whichInput"));
    await page.fill("#whichInput", String(2 * Number(await text("#nValue"))));
    log("pair at maximum:", await page.inputValue("#whichInput"));
  }

  // Second configuration: seven sides, a highlighted pair, a moved corner
  // and a moved point on the first bisector.
  await setSides(7);
  await page.fill("#whichInput", "2");
  await drag('[aria-label^="Point P"]', 0.41, 0.38);
  log("seven sides, moved point:", await text("#status"));
  await shot("heptagon");

  log("final:", await text("#status"));
};
