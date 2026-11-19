// Bachet's Magic Trick: pick a pair, reveal it, work every option to both ends.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bachet

export default async ({ page, first, log, shot, text }) => {
  // --- the page as it opens -------------------------------------------------
  log("initial:", await text("#status"), "|", await text("#stageHeading"));
  log("pair cards:", await page.locator(".pair-card").count(), "| N =", await text("#nOut"));
  await shot("initial");

  // --- every option to its maximum -----------------------------------------
  const step = async (selector) => {
    for (let i = 0; i < 8 && await page.locator(selector).isEnabled(); i++) await page.click(selector);
  };
  await step("#nMore");
  await page.check("#straightChk");
  await page.check("#randomChk");
  log("max options: N =", await text("#nOut"),
    "| straight =", await page.locator("#straightChk").isChecked(),
    "| randomize =", await page.locator("#randomChk").isChecked());
  log("max list:", await text("#status"));
  await shot("max-options");

  // Keyboard: arrow to a neighbouring pair, Enter to choose it, then Proceed.
  await page.locator(".pair-card").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const pairFocus = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("pair-card"));
  log("keyboard pair choice:", await text("#status"), "| focus still on a pair:", pairFocus);
  await page.locator("#proceedBtn").focus();
  await page.keyboard.press("Enter");
  log("after Proceed:", await text("#status"), "|", await text("#stageHeading"),
    "| grid cells:", await page.locator(".grid-cell").count());
  await shot("max-grid");

  // Two more keyboard moves: mark two rows; the computer replies in words.
  await page.locator(".row-btn").first().focus();
  await page.keyboard.press("Enter");
  await page.locator(".row-btn").nth(2).focus();
  await page.keyboard.press("Enter");
  const boardFocus = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("row-btn"));
  log("after two row moves:", await text("#status"), "| focus still on the board:", boardFocus,
    "| revealed cards:", await page.locator(".grid-cell.revealed").count());
  await shot("revealed");

  // Press the remaining buttons in the order a player would: Reset, then a
  // fresh trick by mouse, then both steppers and both checkboxes each way.
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| back at", await text("#stageHeading"));
  await page.locator(".pair-card").first().click();
  log("mouse pair choice:", await text("#status"));
  await page.locator("#proceedBtn").click();
  log("mouse Proceed:", await text("#status"));
  log("stage-2 hint:", await text("#stageHint"));
  await shot("mouse-stage2");

  // --- both option extremes, including past each end -----------------------
  await step("#nLess");
  log("N at minimum:", await text("#nOut"), "| pairs:", await page.locator(".pair-card").count());
  await shot("n-min");
  await page.evaluate(() => document.getElementById("nLess").click()); // a Min below Min: clamped
  log("one below minimum:", await text("#nOut"));

  await page.uncheck("#straightChk");
  await page.uncheck("#randomChk");
  log("both options off:", await text("#status"));
  log("straight off list:", (await page.locator(".pair-card").allTextContents()).slice(0, 3).join(" | "));

  await page.check("#straightChk");
  await page.check("#randomChk");
  await step("#nMore");
  log("N at maximum:", await text("#nOut"), "| pairs:", await page.locator(".pair-card").count());
  await page.evaluate(() => document.getElementById("nMore").click()); // a Max above Max: clamped
  log("one above maximum:", await text("#nOut"));
  await shot("n-max");

  // Play one full trick at the largest board, by mouse, to the worded end.
  await page.locator(".pair-card").nth(1).click();
  await page.locator("#proceedBtn").click();
  const rows = page.locator(".row-btn");
  await rows.nth(1).click();
  await rows.nth(4).click();
  log("largest-board reveal:", await text("#status"),
    "| revealed:", await page.locator(".grid-cell.revealed").count());
  await shot("largest-reveal");

  if (first) log("done: the status sentence names the two numbers in words.");
};
