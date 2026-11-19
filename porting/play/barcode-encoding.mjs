// Barcode Encoding: a demo, so "explore" it at both option extremes rather than win or lose.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs barcode-encoding
export default async ({ page, first, log, shot, text }) => {
  log("initial:", await text("#status"));
  await shot("initial");

  // Every option at its maximum: EAN-13, the last digit, and digit value 9.
  await page.click("#modeEan");
  await page.focus(".digit-cell.selected");
  await page.keyboard.press("End");
  for (let i = 0; i < 9; i++) await page.click("#incBtn");
  log("maximum options:", await text("#status"));
  await shot("max");
  if (!first) return; // the dark run has the screenshot it needs

  // Two keyboard moves on their own, with the focus still on the digit strip.
  await page.focus(".digit-cell.selected");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? el.getAttribute("aria-label") : null;
  });
  log("two keyboard moves:", await text("#status"));
  log("focus after the moves:", focused, focused && /^Digit \d+/.test(focused) ? "(still on the digits)" : "(LOST)");

  // Press every button in the order a player would, and say what each did.
  for (const id of ["#modeUpc", "#modeEan", "#prevBtn", "#decBtn", "#incBtn", "#nextBtn", "#newBtn"]) {
    await page.click(id);
    log(`pressed ${id}:`, await text("#status"));
  }

  // The other extreme: UPC-A, the first digit, and digit value 0.
  await page.click("#modeUpc");
  await page.focus(".digit-cell.selected");
  await page.keyboard.press("Home");
  for (let i = 0; i < 9; i++) await page.click("#decBtn");
  log("minimum options:", await text("#status"));
  await shot("min");

  // Going below 0 and above 9 must stop, not wrap around.
  await page.click("#decBtn");
  log("one more decrease at zero:", await text("#status"));
  await page.focus(".digit-cell.selected");
  await page.keyboard.press("End");
  for (let i = 0; i < 9; i++) await page.click("#incBtn");
  await page.click("#incBtn");
  log("one more increase at nine:", await text("#status"));
};
