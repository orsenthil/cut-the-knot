// Heads and tails: turn pins, tick Hint, change the number of pins, keyboard, Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs first-proof
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.dataset.pin !== undefined ? "pin " + a.dataset.pin : a.id); });
  const pin = (i) => page.locator(`#pins g.pin[data-pin="${i}"]`);
  log("initial:", await text("#counts"));
  await shot("initial");
  await page.fill("#nIn", "50"); await page.press("#nIn", "Tab"); await page.check("#hintBox");
  log("50 pins, hint:", await text("#counts"));
  await shot("max-options");
  await page.fill("#nIn", "3"); await page.press("#nIn", "Tab");
  await pin(1).click({ force: true });
  log("turned pin 2 of a triangle:", await text("#counts"), "|", await text("#status"), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await pin(0).click({ force: true });
  log("turned pin 1 too:", await text("#counts"), "|", await text("#status"));
  await page.fill("#nIn", "8"); await page.press("#nIn", "Tab");
  for (const i of [1, 2, 5]) await pin(i).click({ force: true });
  log("8 pins, three turned:", await text("#counts"), "|", await text("#status"));
  await shot("eight");
  await pin(0).focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard: moved to the next pin and turned it:", await text("#counts"), "| focus =", await focus());
  await page.fill("#nIn", "2"); await page.press("#nIn", "Tab");
  log("2 pins typed:", await text("#status"), "|", await page.inputValue("#nIn"));
  await page.uncheck("#hintBox"); log("hint off:", await text("#counts"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| done =", await isDone());
  await shot("reset");
};
