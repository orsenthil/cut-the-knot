// Curry's Paradox: open the picture, push n to its largest and smallest values,
// pick four pieces and both holes, drag each piece to its place with the pointer
// (one drag misses, one snaps), send a piece home with Enter, move one with the
// arrow keys, press Animate, and Reset. The demo has no win or loss: finishing
// the swap is its "done", and "Reset" is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs curry-paradox
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const facts = () => text("#facts");
  const focus = () => page.evaluate(() => { const e = document.activeElement; return e && (e.getAttribute("data-piece") ? "piece " + e.getAttribute("data-piece") : e.id); });
  const homes = () => page.locator(".piece.home").count();
  const setN = async (v) => { await page.fill("#nIn", String(v)); await page.press("#nIn", "Tab"); };
  // Drag piece i by (dx, dy) in cells, using the board's own mapping.
  const dragBy = async (i, dx, dy) => {
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" })); // clear of the sticky header
    const piece = page.locator(`[data-piece="${i}"] polygon`);
    const b = await piece.boundingBox();
    const pts = await piece.getAttribute("points");
    const vb = (await page.getAttribute("#board", "viewBox")).split(" ").map(Number);
    const svg = await page.locator("#board").boundingBox();
    const scale = svg.width / vb[2];
    const xs = pts.split(" ").map((p) => p.split(",").map(Number));
    // a point well inside the piece: the average of its first three vertices
    const cx = (xs[0][0] + xs[1][0] + xs[2][0]) / 3, cy = (xs[0][1] + xs[1][1] + xs[2][1]) / 3;
    const sx = svg.x + (cx - vb[0]) * scale, sy = svg.y + (cy - vb[1]) * scale;
    await page.mouse.move(sx, sy); await page.mouse.down();
    await page.mouse.move(sx + (dx * scale) / 2, sy + (dy * scale) / 2);
    await page.mouse.move(sx + dx * scale, sy + dy * scale);
    await page.mouse.up();
  };

  log("initial:", await facts(), "| pieces home =", await homes());
  await shot("initial");

  // Everything at its largest and smallest.
  await setN(11); log("n = 11:", await facts());
  await shot("max-options");
  await setN(4); log("n = 4:", await facts());
  await setN(99); log("n typed 99:", await facts());
  await setN(1); log("n typed 1:", await facts());
  await setN(6); log("back to n = 6:", await facts());

  // Pointer drags on the page's own figure: the small triangle is moved (-8, +3) from the box offset (5 + 2 = 7 down).
  await dragBy(0, -8, 5); // five cells short of home: it does not snap
  log("a drag that misses:", await text("#status"), "| pieces home =", await homes());
  await page.click("#resetBtn");
  await dragBy(0, -8, 10); // exact: (-8, 3) + gap 7
  log("a drag that lands:", await text("#status"), "| pieces home =", await homes());
  await dragBy(1, 5, 5); // (+5, -2) + gap 7
  log("both dragged:", await text("#status"), "| pieces home =", await homes(), "| done =", await isDone());
  await shot("explored");
  if (!first) return; // the dark run only needs the screenshots above

  // Reset, then Enter and the arrow keys.
  await page.click("#resetBtn");
  await page.focus('[data-piece="1"]');
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowRight");
  log("after arrows, focus =", await focus());
  await page.keyboard.press("Enter");
  log("Enter sends it home:", await text("#status"), "| pieces home =", await homes(), "| focus =", await focus());
  await page.focus('[data-piece="0"]'); await page.keyboard.press("Enter");
  log("both sent home:", await text("#status"), "| done =", await isDone());

  // Four pieces and both holes.
  await page.click("#resetBtn");
  await page.check("#four");
  log("four pieces:", await page.locator(".piece").count(), "pieces");
  await page.check("#perim"); log("hole on the perimeter:", await page.locator(".piece").count());
  await page.check("#inner");
  for (let i = 0; i < 4; i++) { await page.focus(`[data-piece="${i}"]`); await page.keyboard.press("Enter"); }
  log("four pieces home:", await text("#status"), "| done =", await isDone());
  await shot("four");
  await setN(7);
  log("n = 7 drops to two pieces:", await page.locator(".piece").count(), "| four enabled =", await page.locator("#four").isEnabled());

  // Animate, then Reset.
  await setN(6);
  await page.click("#animateBtn");
  await page.waitForTimeout(2500);
  log("after Animate:", await text("#status"), "| pieces home =", await homes(), "| done =", await isDone());
  await shot("animated");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| pieces home =", await homes(), "| done =", await isDone());
  await shot("reset");
};
