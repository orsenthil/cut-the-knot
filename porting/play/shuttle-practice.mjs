// Shuttle Puzzle Practice: read the target from the hint, draw a wrong
// shuttle and Verify (no), then solve it pole by pole and Verify (yes).
// Also: refused height, Remove last, keyboard shuttle, 20 poles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs shuttle-practice
export default async ({ page, first, log, shot, text }) => {
  const box = await page.locator("#board").boundingBox();
  const n = 5;
  const at = (pole, row) => [box.x + ((pole + 1) / (n + 1)) * box.width, box.y + ((60 + (row / 240) * 480) / 600) * box.height];
  const drag = async (a, b, row) => {
    const [x0, y0] = at(a, row), [x1, y1] = at(b, row);
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  };
  await page.check("#hintBox");
  const cyc = (await text("#hint")).match(/cycles: (.*)$/)[1];
  // goal[i] = pole (1-based) that top i+1 must reach
  const goal = new Array(n);
  for (const c of cyc.match(/\(([^)]*)\)/g)) {
    const v = c.slice(1, -1).split(",").map(Number);
    v.forEach((x, k) => { goal[x - 1] = v[(k + 1) % v.length]; });
  }
  log("target cycles:", cyc, "| goal:", goal.join(","));
  await page.click("#verifyBtn");
  log("verify with no shuttles:", await text("#status"));
  // Solve: put the right traveller on pole p, p = 0..n-1.
  const cur = Array.from({ length: n }, (_, i) => i);
  let row = 30;
  for (let p = 0; p < n; p++) {
    const want = goal.indexOf(p + 1);
    const q = cur.indexOf(want);
    if (q !== p) { await drag(p, q, row); row += 30; [cur[p], cur[q]] = [cur[q], cur[p]]; }
  }
  log("hint:", await text("#hint"));
  await page.click("#verifyBtn");
  log("after solving:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("solved");
  if (!first) return;

  await drag(0, 1, 30);
  log("same height again:", await text("#status"));
  await drag(0, 1, 225);
  await page.click("#verifyBtn");
  log("one extra shuttle:", await text("#status"));
  await page.click("#removeBtn");
  await page.click("#verifyBtn");
  log("after Remove last:", await text("#status"));
  // Keyboard: a shuttle from pole 1 to pole 2.
  await page.focus("#board");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log("keyboard shuttle:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.fill("#polesInput", "20");
  await page.dispatchEvent("#polesInput", "change");
  log("20 poles:", await text("#status"));
  await shot("twenty");
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
