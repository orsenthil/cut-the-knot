// Arithmetic Magic Matrix: the 5x5 sum board, a full diagonal (the trick),
// keyboard play with focus kept on the board, the wrong kind of full pick,
// then the largest 10x10 product board and the hint controls at their limits.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs arith-magic
export default async ({ page, first, log, shot, text }) => {
  const cell = (i) => page.locator(".cell").nth(i);
  const status = async () => JSON.stringify(await text("#status"));
  const result = async () => JSON.stringify(await text("#result"));
  const setValue = async (selector, value) => page.$eval(selector, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);

  log("initial:", await result(), "| status:", await status());
  await shot("initial");

  // Show the hidden controls, then pick one square in every row and column.
  await page.click("#hintIn");
  log("hint on:", JSON.stringify(await text("#prediction")));
  for (let r = 0; r < 5; r++) await cell(r * 5 + r).click();
  log("five-square diagonal:", await result(), "| status:", await status());
  await shot("done");
  if (!first) return; // the dark run only needs the picture above

  // Clear, then two keyboard moves: focus must stay on the board.
  await page.click("#clearBtn");
  log("after Pick again:", await result(), "| status:", await status());
  await cell(0).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const focusKept = await page.evaluate(() =>
    document.activeElement === document.querySelectorAll(".cell")[1]);
  log("keyboard right then Enter:", await result(), "| focus still on cell 2:", focusKept);

  // A full pick with two squares in one row is not the trick.
  await page.click("#clearBtn");
  for (const i of [0, 1, 6, 12, 18]) await cell(i).click();
  log("five squares, two in row 1:", await result(), "| status:", await status());
  await shot("not-the-trick");

  // Maximum size in multiplication mode, then a full diagonal there too.
  await setValue("#sizeIn", "10");
  await page.click("#prodOp");
  log("largest product board:", await text("#sizeOut"), "|", await result());
  await shot("max-product");
  for (let r = 0; r < 10; r++) await cell(r * 10 + r).click();
  log("ten-square product diagonal:", await result(), "| status:", await status());
  await shot("product-done");

  // The hint numbers: click right half (up), left half (down), arrow key up.
  const control = (i) => page.locator(".row-control").nth(i);
  const before = await control(0).getAttribute("aria-label");
  await control(0).click({ position: { x: 38, y: 18 } });
  const afterRight = await control(0).getAttribute("aria-label");
  await control(0).click({ position: { x: 4, y: 18 } });
  const afterLeft = await control(0).getAttribute("aria-label");
  await control(0).focus();
  await page.keyboard.press("ArrowRight");
  const afterKey = await control(0).getAttribute("aria-label");
  log("row 1 control:", before, "| right click:", afterRight,
    "| left click:", afterLeft, "| arrow:", afterKey);
  await shot("controls");

  // And the smallest size, back in sum mode, ends with a fresh board.
  await setValue("#sizeIn", "2");
  await page.click("#sumOp");
  await page.click("#newBtn");
  log("smallest sum board:", await text("#sizeOut"), "| status:", await status());
};
