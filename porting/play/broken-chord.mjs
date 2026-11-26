// Broken Chord: an illustration, so there is no win or loss. Show two
// configurations of the triangle and check the claim in each.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs broken-chord
export default async ({ page, first, log, shot, idle, text }) => {
  const cHandle = page.locator('#board [aria-label^="Point C"]');
  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: the applet's own triangle, AC longer than BC.
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("AC longer than BC:", await text("#status"));
  await shot("start");

  // Configuration 2: drag C toward A so that BC becomes the longer side.
  const box = await cHandle.boundingBox();
  if (!box) throw new Error("no handle for C");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 140, y - 15, { steps: 12 });
  await page.mouse.up();
  await page.click("#checkBtn");
  log("BC longer than AC:", await text("#status"));
  await shot("mirrored");

  if (!first) return; // the dark run only needs the two screenshots

  // Two moves with the keyboard alone; focus must stay on C.
  await cHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard moves:", await text("#status"));

  // Reset, then drag A so the triangle is tilted in the other direction.
  await page.click("#newBtn");
  const aHandle = page.locator('#board [aria-label^="Point A"]');
  const aBox = await aHandle.boundingBox();
  if (!aBox) throw new Error("no handle for A");
  await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(aBox.x + aBox.width / 2 + 40, aBox.y + aBox.height / 2 - 70, { steps: 10 });
  await page.mouse.up();
  await page.click("#checkBtn");
  log("after tilting A:", await text("#status"));

  // Every toggle both ways; the hint the status asks for stays on.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.keyboard.press("r");
  await page.keyboard.press("h");
  await page.keyboard.press("n");
  await page.keyboard.press("c");
  log("after buttons and keys:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
