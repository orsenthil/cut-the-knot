// Merlin's Magic Squares: press buttons, undo, use the hint to solve, then the torus and 2 states.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs merlin
export default async ({ page, first, log, shot, text }) => {
  const cells = page.locator("#board .b");
  const vals = () => cells.evaluateAll((bs) => bs.map((b) => b.textContent).join(""));
  log("start:", await vals(), "| status:", await text("#status"));
  await shot("start");
  await cells.nth(0).click(); await cells.nth(4).click();
  log("after two presses:", await vals(), "| undo enabled:", await page.locator("#undoBtn").isEnabled());
  await page.click("#undoBtn"); await page.click("#undoBtn");
  log("after two undos, undo disabled:", await page.locator("#undoBtn").isDisabled());
  await page.check("#hintBox");
  const hint = (await vals()).split("").map(Number);
  log("hint:", hint.join(""), "| title:", await text("#boardTitle"));
  await shot("hint");
  await page.uncheck("#hintBox");
  for (let k = 0; k < 9; k++) for (let t = 0; t < hint[k]; t++) await cells.nth(k).click();
  log("pressed the hint:", await vals(), "|", await text("#status"));
  await shot("solved");
  if (!first) return;
  await page.locator('input[name="geo"]').nth(1).check();
  log("torus: modulus options disabled except 3:", await page.locator('input[name="mod"]:disabled').count(), "| states checked:", await page.locator('input[name="mod"]:checked').getAttribute("value"));
  await page.locator('input[name="geo"]').nth(0).check();
  await page.locator('input[name="mod"]').nth(0).check();
  log("2 states:", await vals());
  await page.locator('input[name="geo"]').nth(2).check();
  log("third geometry label:", await page.locator('input[name="geo"]').nth(2).evaluate((e) => e.nextSibling.textContent));
  await target(page);
  await page.click("#resetBtn");
  log("after reset:", await vals());
};
async function target(page) { await page.locator("#targetGrid .b").nth(4).click(); }
