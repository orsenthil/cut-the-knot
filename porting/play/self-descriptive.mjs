// The SelfDescriptive demo: change counts by hand, iterate, run Auto, clear
// the list, take the base to both ends and use the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs self-descriptive

export default async ({ page, log, shot, text }) => {
  const counts = async () => (await page.locator(".count").allTextContents()).join(" ");
  const rows = async () => page.locator(".history-row").count();

  log("at the start, base:", await page.inputValue("#baseInput"), "counts:", await counts());
  log("status:", await text("#status"));
  await shot("start");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator(".count").first().focus();
  await page.keyboard.press("ArrowRight");
  let focus = await page.evaluate(() => document.activeElement?.className + ":" + document.activeElement?.dataset.index);
  log("after one ArrowRight, focus:", focus, "| counts:", await counts());
  await page.keyboard.press("ArrowLeft");
  focus = await page.evaluate(() => document.activeElement?.className + ":" + document.activeElement?.dataset.index);
  log("after one ArrowLeft, focus:", focus, "| status:", await text("#status"));
  await shot("keyboard");

  // Press every button in a player's order: both halves of a count, Iterate,
  // Auto/Stop and Clear.
  const first = page.locator(".count").first();
  const box = await first.boundingBox();
  await page.click(".count >> nth=0", { position: { x: 4, y: box.height / 2 } });
  log("left half lowered the first count to:", await first.textContent());
  await page.click(".count >> nth=0", { position: { x: box.width - 4, y: box.height / 2 } });
  log("right half raised it back to:", await first.textContent());
  await page.click("#iterateBtn");
  log("after Iterate:", await counts(), "| rows:", await rows(), "|", await text("#status"));
  await page.click("#autoBtn");
  await page.waitForTimeout(1400);
  await page.click("#autoBtn");
  log("after Auto and Stop:", await counts(), "|", await text("#status"));
  await shot("auto");
  await page.click("#clearBtn");
  log("after Clear, rows:", await rows(), "|", await text("#status"));

  // Both extremes of the base spinner.
  for (const value of ["1", "99"]) {
    await page.fill("#baseInput", value);
    await page.press("#baseInput", "Tab");
    log(`base entered as ${value} follows the applet and shows`, await page.inputValue("#baseInput"));
  }
  await page.click("#baseDown");
  await page.click("#baseUp");
  await shot("extremes");

  // The worked base-three example: 1 1 1 reaches 1 11 2 in three steps.
  await page.fill("#baseInput", "3");
  await page.press("#baseInput", "Tab");
  for (let i = 0; i < 3; i++) await page.click("#iterateBtn");
  log("base three after three iterations:", await counts(), "|", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
