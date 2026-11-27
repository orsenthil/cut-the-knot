// CircularPoggendorf: two configurations of the illusion, with the hidden circle revealed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circular-poggendorf
export default async ({ page, first, log, shot, idle, text }) => {
  const radius = () => page.locator('#board [aria-label^="Circle radius point"]');
  const leftEdge = () => page.locator('#board [aria-label^="Bar\'s left edge"]');
  const rightEdge = () => page.locator('#board [aria-label^="Bar\'s right edge"]');

  // The SVG's own transform maps board units to client pixels at phone width.
  const client = (x, y) => page.evaluate(([bx, by]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    const p = new DOMPoint(bx, by).matrixTransform(m);
    return { x: p.x, y: p.y };
  }, [x, y]);
  const dragTo = async (handle, x, y) => {
    await idle("#board");
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle on the board");
    const target = await client(x, y);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
  };

  await idle('#board [aria-label^="Circle radius point"]');
  log("start:", await text("#status"));
  await shot("page-default");

  // First configuration: move the strip towards the middle and widen it.
  await dragTo(leftEdge(), 185, 14);
  await dragTo(rightEdge(), 270, 14);
  log("strip near the centre:", await text("#status"));
  await shot("strip-near-centre");

  // Second configuration: a much larger circle cut by the same strip.
  await dragTo(radius(), 375, 150);
  log("larger circle:", await text("#status"));
  await shot("larger-circle");

  if (!first) return; // the dark run needs the two configurations only

  await page.click("#revealBtn");
  log("revealed:", await text("#status"));
  await shot("whole-circle");

  // Two keyboard moves; focus must stay on the same handle.
  await leftEdge().focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("after keyboard:", await text("#status"));

  await page.click("#revealBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
