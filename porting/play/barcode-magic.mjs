// Barcode Magic: twelve question marks, every digit at its extremes, keyboard
// steps with focus kept on the board, then Check on blanks, on eleven digits
// with one hidden, on a valid code and on a broken one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs barcode-magic
export default async ({ page, first, log, shot, text }) => {
  const cell = (i) => page.locator(".digit").nth(i);
  const shown = () => page.$$eval(".digit", (els) => els.map((e) => e.textContent).join(" "));
  // The applet's right half counts up, left half counts down. From "?" one
  // left click gives 9 and one right click gives 0.
  const up = async (i) => cell(i).click({ position: { x: 36, y: 20 } });
  const down = async (i) => cell(i).click({ position: { x: 8, y: 20 } });
  const setFromBlank = async (i, value) => { for (let k = 0; k <= value; k++) await up(i); };

  log("initial state:", JSON.stringify(await shown()), "| status:", JSON.stringify(await text("#status")));
  await shot("initial");

  // Every cell at its maximum: one downward click turns each "?" into a 9.
  for (let i = 0; i < 12; i++) await down(i);
  log("all cells at their maximum:", JSON.stringify(await shown()));
  await shot("max");

  // Every cell at its minimum, after Reset.
  await page.click("#newBtn");
  for (let i = 0; i < 12; i++) await up(i);
  log("all cells at their minimum:", JSON.stringify(await shown()));
  await shot("min");

  // Two keyboard moves, checking focus never leaves the digits.
  await page.click("#newBtn");
  await cell(0).focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const focusAfterTwo = await page.evaluate(() =>
    document.activeElement === document.querySelectorAll(".digit")[0]);
  log("two keyboard steps up:", JSON.stringify(await shown()),
    "| focus still on digit 1:", focusAfterTwo);
  await page.keyboard.press("ArrowDown");
  const focusAfterDown = await page.evaluate(() =>
    document.activeElement === document.querySelectorAll(".digit")[0]);
  log("one keyboard step down:", JSON.stringify(await shown()),
    "| focus still on digit 1:", focusAfterDown);

  // Check with twelve blanks: the computer refuses to guess.
  await page.click("#checkBtn");
  log("Check with twelve blanks:", await text("#status"));
  await shot("too-many");

  // A real UPC-A code with digit 9 (index 8) left out.
  await page.click("#newBtn");
  const code = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];
  for (let i = 0; i < 12; i++) if (i !== 8) await setFromBlank(i, code[i]);
  await page.click("#checkBtn");
  log("Check with one digit hidden:", await text("#status"));
  await shot("missing");
  if (!first) return; // dark only needs the pictures above

  // Fill the hidden 1, then Check again: the code is now valid.
  await setFromBlank(8, 1);
  await page.click("#checkBtn");
  log("Check after filling the 1:", await text("#status"));
  await shot("valid");

  // Break one digit and Check once more.
  await up(0);
  await page.click("#checkBtn");
  log("Check after changing the first digit:", await text("#status"));
  await shot("invalid");

  // The reset button is the last one a player would press.
  await page.click("#newBtn");
  log("after Reset:", JSON.stringify(await shown()), "| status:", JSON.stringify(await text("#status")));
};
