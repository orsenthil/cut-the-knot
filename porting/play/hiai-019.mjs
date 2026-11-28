// HIAI019: two configurations of the Napoleon circle chain.
// There is no win or loss; the illustration is explored instead.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hiai-019
export default async ({ page, first, log, shot, text }) => {
  const aHandle = page.locator('[aria-label^="Vertex A"]');
  const dHandle = page.locator('[aria-label^="Point D"]');

  async function drag(locator, dx, dy) {
    const box = await locator.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  // Configuration one: the starting triangle and chain, with the 60 degree
  // angle marks of the premises and the statement shown.
  await page.click("#premisesBox");
  await page.click("#statementBox");
  log("configuration one:", await text("#status"));
  await shot("configuration-one");

  // Configuration two: the chain point D travels round its circle and the
  // triangle corner A is dragged; E and F follow through the porism.
  for (let i = 0; i < 7; i++) await page.click('button[data-point="0"][data-turn="0.12"]');
  await drag(aHandle, -42, -16);
  log("configuration two:", await text("#status"));
  await shot("configuration-two");

  if (!first) return; // the dark run only needs the two pictures

  // Keyboard alone: a focused D keeps focus after the chain follows it.
  await dHandle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);

  // Press every control the page offers, in both directions.
  for (const id of ["namesBox", "premisesBox", "statementBox"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  for (const point of [0, 1, 2]) {
    await page.click(`button[data-point="${point}"][data-turn="-0.12"]`);
    await page.click(`button[data-point="${point}"][data-turn="0.12"]`);
  }
  log("after all controls:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
