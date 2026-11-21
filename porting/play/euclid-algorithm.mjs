// Euclid's algorithm: change the digits and the options.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euclid-algorithm
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.className + " " + a.dataset.place); });
  const nums = () => page.evaluate(() => [...document.querySelectorAll("#nums .number")].map((n) => [...n.querySelectorAll("button")].map((b) => b.textContent).join("")).join(", "));
  const lastLine = () => page.evaluate(() => document.querySelector("#steps li.gcd").textContent);
  const steps = () => page.locator("#steps li").count();
  const typeNumber = async (which, str) => { await page.locator(`button.digit.${which}`).first().focus(); for (const k of str) { await page.keyboard.press(k); await page.keyboard.press("ArrowRight"); } };
  log("initial:", await nums(), "|", await lastLine());
  await shot("initial");
  await page.fill("#digitsIn", "4"); await page.press("#digitsIn", "Tab");
  log("4 digits:", await nums(), "|", await steps(), "lines |", await lastLine());
  await shot("max-options");
  await page.locator("button.digit.a").last().click();
  log("pressed a units digit:", await nums(), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await typeNumber("a", "0089"); await typeNumber("b", "0055");
  log("typed the Fibonacci pair 89 and 55:", await nums(), "|", await steps(), "lines |", await lastLine(), "| focus =", await focus());
  await shot("fibonacci");
  await typeNumber("b", "0000");
  log("second number 0:", await text("#status"), "|", await lastLine());
  await page.uncheck("#autoBox"); await page.locator("button.digit.a").last().click();
  log("not autonomous, units digit pressed:", await nums());
  await page.fill("#digitsIn", "7"); await page.press("#digitsIn", "Tab");
  log("7 digits typed:", await text("#status"), "|", await page.inputValue("#digitsIn"));
  await page.click("#newBtn");
  log("new numbers:", await nums(), "| done =", await isDone());
  await shot("reset");
};
