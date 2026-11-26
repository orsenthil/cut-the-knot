// bicolor: two configurations — a pointer drag with XOR, then a keyboard move
// with NOT. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bicolor
export default async ({ page, log, shot, text }) => {
  // Math.random = 0.01 makes New Puzzle choose SelectThreePure with bit 0
  // missing, so squares 1, 2 and 3 start with the numbers 2, 4 and 8.
  const restart = () => page.evaluate(() => {
    Math.random = () => 0.01;
    document.getElementById("newBtn").click();
  });

  await restart();
  await page.click('button[data-op="2"]');
  await page.waitForTimeout(250); // let the pressed-button colour settle
  log("start:", await text("#status"));
  const from = await page.locator('[data-cell="1"]').boundingBox();
  const to = await page.locator('[data-cell="2"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  log("XOR drag of square 1 onto square 2:", await text("#status"));
  await shot("xor-drag");

  await restart();
  await page.click('button[data-op="3"]');
  await page.waitForTimeout(250);
  await page.locator('[data-cell="1"]').focus();
  await page.keyboard.press("Enter");       // pick square 1 (number 2)
  await page.keyboard.press("ArrowRight");  // move focus to square 2
  await page.keyboard.press("Enter");       // NOT: 15 - 2 = 13 in square 2
  log("NOT with the keyboard, square 1 onto square 2:", await text("#status"));
  await shot("not-keyboard");
};
