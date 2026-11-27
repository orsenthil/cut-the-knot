// Frieze: seed a multiplicative and an additive lattice, compute both, and
// press every option. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs frieze
export default async ({ page, first, log, shot, text }) => {
  const seed = async (i, j, right = true) => {
    const p = await page.evaluate((cell) => {
      const h = document.querySelector(`[data-cell="${cell}"]`);
      const m = document.getElementById("board").getScreenCTM();
      const c = new DOMPoint(Number(h.getAttribute("cx")), Number(h.getAttribute("cy"))).matrixTransform(m);
      return { x: c.x, y: c.y, r: Number(h.getAttribute("r")) * m.a };
    }, `${i},${j}`);
    await page.mouse.click(p.x + (right ? p.r * 0.6 : -p.r * 0.6), p.y);
  };

  const showBoard = async () => {
    await page.locator("#stage").scrollIntoViewIfNeeded();
    await page.evaluate(() => { document.getElementById("stage").scrollLeft = 0; });
  };

  // Configuration 1: the default adding rule, two colours, ten rows.
  for (const [i, j] of [[0, 0], [0, 3], [0, 6], [4, 0], [8, 1]]) await seed(i, j);
  await page.click("#computeBtn");
  await showBoard();
  log("after Compute with + :", await text("#status"));
  await shot("add-pattern");

  if (!first) return; // the dark run only needs the two screenshots

  // Configuration 2: the multiplying rule, twelve rows, ten colours, circles.
  await page.click('[data-op="1"]');
  await page.fill("#moduloInput", "10");
  await page.locator("#moduloInput").press("Tab");
  await page.click('[data-rows-step="1"]');
  await page.click('[data-rows-step="1"]');
  await page.check('input[name="show"][value="circles"]');
  for (const [i, j] of [[0, 0], [0, 3], [5, 0], [10, 2]]) await seed(i, j);
  await page.click("#computeBtn");
  await showBoard();
  log("after Compute with x :", await text("#status"));
  await shot("multiply-circles");

  // Largest options: 50 rows, 10 colours, multiplication, circles. The
  // board scrolls inside .stage instead of shrinking the dots to a pinprick.
  await page.fill("#rowsInput", "50");
  await page.locator("#rowsInput").press("Tab");
  await seed(0, 0);
  await seed(25, 0);
  await page.click("#computeBtn");
  await showBoard();
  log("largest options:", await text("#status"));
  await shot("max-rows-circles");

  // Keyboard: two changes on one dot, with focus kept on the board.
  await page.focus('[data-cell="0,1"]');
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement.getAttribute("data-cell"));
  log("keyboard changes, focus:", focused, "|", await text("#status"));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  log("after moving down:", await text("#status"));

  // Press every remaining control, including both directions of each option.
  await page.click("#undoBtn");
  log("after Undo:", await text("#status"));
  await page.check("#simpleBox");
  log("Simple on:", await text("#status"));
  await page.uncheck("#simpleBox");
  await page.click('[data-mod-step="-1"]');
  await page.click('[data-mod-step="1"]');
  await page.click('[data-rows-step="-1"]');
  await page.click('[data-rows-step="1"]');
  await page.check('input[name="show"][value="numbers"]');
  await page.click("#computeBtn");
  log("rule refilled the diamonds:", await text("#status"));
  await page.click("#newBtn");
  log("after New Game:", await text("#status"));
};
