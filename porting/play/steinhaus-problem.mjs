// Steinhaus' Problem: place three tiles by dragging (one bad), move it,
// keyboard, examples, remove last, clear.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs steinhaus-problem
export default async ({ page, first, log, shot, text }) => {
  const svgBox = async () => { const b = page.locator("#board"); await b.evaluate((e) => e.scrollIntoView({ block: "center" })); return b.boundingBox(); };
  const px = (b, x, y) => [b.x + (x / 700) * b.width, b.y + (y / 290) * b.height];
  const drop = async (fromX, fromY, t) => {
    const b = await svgBox();
    const [x0, y0] = px(b, fromX, fromY), [x1, y1] = px(b, 90 + 0.6 * t, 170);
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  };
  await drop(38, 225, 300);
  await drop(38, 225, 800);
  log("0.3, 0.8:", await text("#status"));
  await drop(38, 225, 200);
  log("0.2 too:", await text("#status"));
  await shot("crowded");
  if (!first) return;
  await page.focus('#board .tile[data-i="2"]');
  for (let i = 0; i < 7; i++) await page.keyboard.press("Shift+ArrowRight");
  log("tile 3 moved by keyboard:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.i));
  await page.focus('#board .tile.waiting');
  await page.keyboard.press("Enter");
  log("tile 4 at 0.5:", await text("#status"));
  await page.click("#removeBtn");
  log("remove last:", await text("#status"));
  await page.selectOption("#exampleSel", "Guy, 17");
  await page.click("#exampleBtn");
  log("Guy's 17:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("seventeen");
  await page.click("#clearBtn");
  log("clear:", await text("#status"));
};
