// BreadthWidth: two configurations of the illusion, with the probe on each stack.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs breadth-width
export default async ({ page, first, log, shot, idle, text }) => {
  const probe = () => page.locator('#board [aria-label^="Measuring probe"]');
  const layers = () => page.locator('#board [aria-label^="Layer handle"]');

  // The SVG's own transform maps board units to client pixels at phone width.
  const client = (x, y) => page.evaluate(([bx, by]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    const p = new DOMPoint(bx, by).matrixTransform(m);
    return { x: p.x, y: p.y };
  }, [x, y]);
  const dragTo = async (handle, x, y) => {
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle on the board");
    const target = await client(x, y);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("five");

  // First configuration: eight layers, with the probe on the right-hand stack.
  for (let i = 0; i < 3; i++) await page.click("#moreBtn");
  await dragTo(probe(), 320, 150);
  log("eight layers, probe on right:", await text("#status"));
  await shot("eight-right");

  if (!first) return; // the dark run only needs the two screenshots

  // Second configuration: five layers again, then the full 20 on the ruler,
  // with the probe on the middle barrel.
  await page.click("#resetBtn");
  await dragTo(layers(), 400, 258);
  await dragTo(probe(), 200, 150);
  log("twenty layers, probe on middle:", await text("#status"));
  await shot("twenty-middle");

  // The ruler handle keeps focus while the arrow keys change its value.
  await layers().focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("after keyboard:", await text("#status"));

  await page.click("#lessBtn");
  await page.click("#lessBtn");
  log("after two fewer layers:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
