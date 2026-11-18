// The Game of Y: tour the board, show the reduced subgame, shrink down to a
// single cell, then exercise Reset, both size buttons and keyboard play.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs y-theory

export default async ({ page, first, log, shot, text }) => {
  const cellCount = () => page.locator(".ycell").count();

  log("fresh board:", await text("#nOut"), "on a side,", await cellCount(), "cells");
  log("status:", await text("#status"));
  await shot("board");

  // Switching one chip and revealing the hidden reduced board.
  await page.locator('.ycell[data-id="0"]').click();
  log("after switching a chip:", await text("#status"));
  await page.check("#subgameCheck");
  log("subgame dots:", await page.locator(".dot").count());
  await shot("subgame");

  // The reduction works all the way down to one cell.
  for (let i = 0; i < 6; i++) await page.click("#shrinkBtn");
  log("after six shrinks:", await text("#nOut"), "on a side,", await cellCount(), "cell");
  log("single-cell status:", await text("#status"));
  log("shrink button disabled:", await page.locator("#shrinkBtn").isDisabled());
  await shot("shrunk");

  if (first) {
    await page.uncheck("#subgameCheck");
    await page.click("#resetBtn");
    await page.click("#moreBtn");
    log("after +:", await text("#nOut"), "on a side,", await cellCount(), "cells");
    await page.click("#lessBtn");
    log("after -:", await text("#nOut"), "on a side,", await cellCount(), "cells");

    await page.focus('.ycell[data-id="0"]');
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.getAttribute("aria-label") : "none";
    });
    log("after keyboard play, focus is on:", focused);
    await shot("keyboard");
  }
};
