// BOL5: an illustration, so there is no win or loss. Show two configurations
// of C and check the claim in each.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-5
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = page.locator('#board [aria-label^="Point C"]');
  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: the applet's own C at 30% of AB, with the proof shown.
  await page.click("#checkBtn");
  await page.click("#hintBtn");
  log("first configuration:", await text("#status"));
  await shot("start");

  // Configuration 2: drag C toward A, where both circles shrink together.
  const box = await handle.boundingBox();
  if (!box) throw new Error("no handle for C");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 95, y, { steps: 10 });
  await page.mouse.up();
  await page.click("#checkBtn");
  log("after dragging C toward A:", await text("#status"));
  await shot("near-A");

  if (!first) return; // the dark run only needs the two screenshots

  // Two moves with the keyboard alone; focus must stay on C.
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard moves:", await text("#status"));

  // Reset, walk C to the midpoint with the keyboard and check the claim.
  await page.click("#newBtn");
  await handle.focus();
  for (let i = 0; i < 19; i++) await page.keyboard.press("ArrowLeft");
  await page.click("#checkBtn");
  log("at the midpoint:", await text("#status"));
  await shot("middle");

  // Every toggle both ways; the hint button the status asks for stays on.
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
