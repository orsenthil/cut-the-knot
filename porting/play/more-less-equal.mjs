// More, Less or Equal: unbalance 1 + 1 = 2 and balance it again, go
// negative, divide by zero, try every operation and the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs more-less-equal
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await page.click('[data-nudge="b:1"]');
  log("after + on b:", await text("#status"));
  await page.click('[data-nudge="c:1"]');
  log("after + on c:", await text("#status"));
  await shot("balanced");
  if (!first) return;

  // Click the left half of the first number three times.
  const box = await page.locator("#num-a").boundingBox();
  for (let i = 0; i < 3; i++) await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
  log("after three clicks on a's left half:", await text("#status"));
  await page.focus("#num-b");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  log("after three ArrowDown on b:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.check('input[value="-"]');
  log("minus:", await text("#status"));
  await page.check('input[value="x"]');
  log("times:", await text("#status"));
  await page.check('input[value="/"]');
  await page.keyboard.press("Tab");
  for (let i = 0; i < 1; i++) await page.click('[data-nudge="b:1"]');
  log("divide:", await text("#status"));
  await shot("divide-by-zero");
  await page.click('[data-nudge="b:1"]');
  log("divide again:", await text("#status"));
  await page.check('input[value="+"]');
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("final");
};
