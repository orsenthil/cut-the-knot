// Trans Example: draw shuttles, verify every line (done), then meet the
// applet's refusal ("This location is occupied!"), exercise every button and
// the pole count in both directions, and look at the biggest board.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs trans-example
export default async ({ page, first, log, shot, text }) => {
  const boardBox = () => page.locator("#board").boundingBox();
  const poleCount = async () => Number(await page.inputValue("#polesInput"));
  const px = (box, n, p) => box.x + ((p + 1) * box.width) / (n + 1);
  const py = (box, h) => box.y + (box.height * (40 + h * 500)) / 600;

  async function drag(a, b, h) {
    const box = await boardBox();
    const n = await poleCount();
    await page.mouse.move(px(box, n, a), py(box, h));
    await page.mouse.down();
    await page.mouse.move(px(box, n, b), py(box, h), { steps: 6 });
    await page.mouse.up();
  }
  async function clickPole(p) {
    const box = await boardBox();
    const n = await poleCount();
    await page.mouse.click(px(box, n, p), py(box, 0.5));
  }
  async function setPoles(n) {
    await page.fill("#polesInput", String(n));
    await page.press("#polesInput", "Tab");
  }

  // Two shuttles by mouse, one by keyboard alone.
  await drag(0, 2, 0.35);
  await drag(1, 3, 0.65);
  await page.focus("#board");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter"); // start a shuttle on line 5
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter"); // finish it on line 1
  const focusId = await page.evaluate(() => document.activeElement.id);
  log("focus after keyboard shuttle:", focusId);
  if (focusId !== "board") throw new Error("focus left the board");
  log("after drawing:", await text("#status"));

  // Verify every line: the play ends done.
  await page.click("#verifyBtn");
  for (let p = 0; p < 5; p++) await clickPole(p);
  log("after verifying all:", await text("#status"));
  const removeDisabled = await page.isDisabled("#removeBtn");
  log("Remove last disabled in Verify:", removeDisabled);
  await shot("win");
  if (!first) return; // the dark run only needs the screenshot above

  // Back to Draw, remove shuttles one by one.
  await page.click("#drawBtn");
  log("back in Draw:", await text("#status"));
  await page.click("#removeBtn");
  await page.click("#removeBtn");
  await page.click("#removeBtn");
  log("Remove last on empty board disabled:", await page.isDisabled("#removeBtn"));

  // The applet's refusal: a second shuttle at the same height on a line.
  await drag(0, 1, 0.5);
  await drag(0, 2, 0.5);
  log("occupied refusal:", await text("#status"));
  await shot("loss");

  // Every option in both directions, including out-of-range values.
  await setPoles(1);
  log("poles below min clamps to:", await page.inputValue("#polesInput"));
  await setPoles(99);
  log("poles above max clamps to:", await page.inputValue("#polesInput"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // The biggest board at phone width: 20 poles, many shuttles.
  for (let i = 0; i < 10; i++) {
    await drag(2 * i, 2 * i + 1, 0.15 + 0.07 * i);
  }
  await drag(0, 19, 0.9);
  await shot("max");
  await page.click("#verifyBtn");
  await clickPole(0);
  log("max board, one line traced:", await text("#status"));
  await shot("max-verify");

  await setPoles(2);
  await drag(0, 1, 0.5);
  await page.click("#verifyBtn");
  await clickPole(0);
  await clickPole(1);
  log("smallest board verified:", await text("#status"));
  await page.click("#resetBtn");
  await setPoles(5);
};