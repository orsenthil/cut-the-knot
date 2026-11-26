// BOL6: show two divisions of the arbelos baseline and the circle that fits.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-6
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = () => page.locator('#board [aria-label^="Point C"]');
  const xOf = async () => {
    const label = await handle().getAttribute("aria-label");
    return Number(/at x (-?\d+)/.exec(label || "")?.[1] ?? 234);
  };

  // Mouse dragging maps screen pixels back through the SVG viewBox.
  async function dragTo(boardX) {
    const box = await handle().boundingBox();
    const svg = await page.locator("#board").boundingBox();
    if (!box || !svg) throw new Error("no handle or board to drag");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const scale = svg.width / 400;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + (boardX - (await xOf())) * scale, y, { steps: 12 });
    await page.mouse.up();
  }

  await idle("#board .geom-handle");
  log("start (3:2):", await text("#status"));
  await shot("three-two");

  // First configuration: C at the midpoint, AC = CB.
  await dragTo(200);
  log("equal halves:", await text("#status"));
  await shot("equal-halves");

  // Second configuration: reset, then C far to the right, AC = 3·CB (x = 285).
  await page.click("#newBtn");
  await dragTo(285);
  log("AC = 3 CB:", await text("#status"));
  await shot("ratio-three");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement must leave focus on the handle after a redraw.
  await page.click("#newBtn");
  await handle().focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  log("focus after keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keys:", await text("#status"));

  // Press every button, and flip each toggle back the other way.
  await page.click("#checkBtn");
  log("after Check:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#auxBtn");
  await page.click("#namesBtn");
  await page.click("#auxBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
