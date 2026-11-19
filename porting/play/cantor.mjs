// The Cantor tent-map demo: log the opening picture, set every option to its
// maximum (a = 3 with Iterate on) and let marks gather, then try both option
// extremes, keyboard-only changes with a focus check, and every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cantor
export default async ({ page, first, log, shot, idle, text }) => {
  log("initial:", await text("#status"), "| a =", await text("#aReadout"));
  await shot("initial");

  // Every option at its maximum: the slider's a = 3 and Iterate switched on.
  await page.locator("#aInput").evaluate((el) => {
    el.value = "3";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.check("#iterateCheck");
  await idle(() => Number(document.getElementById("stepReadout").textContent) >= 18);
  log("maximum options:", await text("#status"), "| step", await text("#stepReadout"));
  await shot("max");

  if (!first) return; // the dark run only needs the screenshots above

  // Option extremes: the smallest a first, then back to the opening value.
  await page.locator("#aInput").evaluate((el) => {
    el.value = "0.05";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("minimum a:", await text("#status"), "| a =", await text("#aReadout"));
  await shot("min");

  await page.locator("#aInput").evaluate((el) => {
    el.value = "3";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("maximum a again:", await text("#status"));

  // Two keyboard moves on the canvas alone, then check the focus is still there.
  await page.locator("#aInput").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.focus("#plot");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  log("after two arrow keys: focus =", focused, "| a =", await text("#aReadout"), "|", await text("#status"));
  await shot("keyboard");

  // Iterate off and on again — the status must follow the checkbox, not a tint.
  await page.uncheck("#iterateCheck");
  log("iterate off:", await text("#status"));
  await page.check("#iterateCheck");
  log("iterate on:", await text("#status"));

  // Every button, in the order a player would use them.
  await page.click("#stepBtn");
  log("after One step:", await text("#status"), "| step", await text("#stepReadout"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| a =", await text("#aReadout"), "| step", await text("#stepReadout"));
  await shot("reset");
};
