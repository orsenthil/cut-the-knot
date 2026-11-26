// Fill the Hex Grid: fill the 3 x 3 board with no missteps, make a misstep and
// take one back, play two moves with the keyboard, then the largest board.
// Run with: NODE_PATH=... node porting/play.mjs play-hex-design
export default async ({ page, first, log, shot, text }) => {
  // The clicks that fill the 3 x 3 board, computed with the core's own inverse.
  const clicks = await page.evaluate(() => {
    const C = PlayHexDesignCore;
    let s = C.click(C.start({ n: 3 }), [0, 0]);
    const out = [[0, 0]];
    for (let t = 0; t < 9; t++) {
      const target = [t % 3, Math.floor(t / 3)];
      if (C.isSelected(s, target)) continue;
      const p = C.solveFor(3, C.last(s), target);
      out.push(p); s = C.click(s, p);
    }
    return out;
  });
  const dot = (i, j) => page.locator("#board .dot").nth(i * 3 + j);
  for (const [i, j] of clicks) await dot(i, j).click();
  log("after a win:", await text("#status"));
  await shot("win");
  if (!first) return;

  await page.click("#resetBtn");
  await dot(1, 1).click();
  await dot(1, 1).click();                       // L * L = L: a misstep
  log("misstep:", await text("#status"), "| missteps", await text("#missed"));
  await dot(2, 1).click();
  await page.click("#backBtn");
  log("after back:", await text("#status"));
  await shot("misstep");

  await page.focus("#board");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  log("keyboard:", await text("#status"), "|", await text("#cursorInfo"), "| focus:", await page.evaluate(() => document.activeElement.id));

  await page.fill("#size", "40");
  await page.dispatchEvent("#size", "change");
  await page.locator("#board .dot").nth(820).click();
  log("N = 40:", await text("#status"));
  await shot("largest");
  await page.fill("#size", "1");
  await page.dispatchEvent("#size", "change");
  log("N below range:", await page.inputValue("#size"));
};
