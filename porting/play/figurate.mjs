// Figurate numbers: hover over the table in each mode, press a cell, arrows, the n box.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs figurate
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const cellPoint = async (c, r) => {
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
    const b = await page.locator("#board").boundingBox();
    const cell = (480 - 16) / 15;
    return [b.x + ((8 + (c + 0.5) * cell) / 480) * b.width, b.y + ((8 + (r + 0.5) * cell) / 480) * b.height];
  };
  const hover = async (c, r) => { const [x, y] = await cellPoint(c, r); await page.mouse.move(x - 3, y); await page.mouse.move(x, y); };
  log("initial:", await text("#identity"));
  await shot("initial");
  await page.fill("#nIn", "14"); await page.press("#nIn", "Tab");
  log("n = 14:", await text("#identity"));
  await shot("max-options");
  await hover(4, 3);
  log("hovering column 4, row 3:", await text("#identity"), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  for (const [value, label] of [["cubes", "Cubes"], ["squares", "Squares"], ["tetrahedral", "Tetrahedral"]]) {
    await page.check(`input[value="${value}"]`);
    await hover(5, 4);
    log(label + ", cell (5, 4):", await text("#identity"));
  }
  await shot("tetra");
  await page.focus("#board"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  log("arrow keys:", await page.inputValue("#nIn"), "| focus =", await focus());
  await page.fill("#nIn", "15"); await page.press("#nIn", "Tab");
  log("n typed 15:", await text("#status"), "|", await page.inputValue("#nIn"));
  await page.click("#resetBtn");
  log("after Reset:", await page.inputValue("#nIn"), "| done =", await isDone());
  await shot("reset");
};
