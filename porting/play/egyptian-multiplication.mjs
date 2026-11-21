// Egyptian multiplication: change the digits and the options.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs egyptian-multiplication
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.className + " " + a.dataset.place); });
  const nums = () => page.evaluate(() => [...document.querySelectorAll("#nums .number")].map((n) => [...n.querySelectorAll("button")].map((b) => b.textContent).join("")).join(" x "));
  log("initial:", await nums(), "|", await text("#sum"));
  await shot("initial");
  await page.fill("#digitsIn", "4"); await page.press("#digitsIn", "Tab"); await page.check("#binBox");
  log("4 digits, binary:", await nums(), "|", (await text("#sum")).slice(0, 80));
  await shot("max-options");
  await page.locator("button.digit.a").last().click();
  log("pressed a units digit:", await nums(), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await page.locator("button.digit.a").first().focus();
  for (const k of "0085") { await page.keyboard.press(k); await page.keyboard.press("ArrowRight"); }
  await page.locator("button.digit.b").first().focus();
  for (const k of "0018") { await page.keyboard.press(k); await page.keyboard.press("ArrowRight"); }
  log("typed 85 and 18:", await nums(), "|", await text("#sum"), "| focus =", await focus());
  await shot("example");
  await page.uncheck("#autoBox");
  await page.locator("button.digit.b").last().click();
  log("not autonomous, units digit pressed:", await nums());
  await page.fill("#digitsIn", "5"); await page.press("#digitsIn", "Tab");
  log("5 digits typed:", await text("#status"), "|", await page.inputValue("#digitsIn"));
  await page.click("#newBtn");
  log("new numbers:", await nums(), "| done =", await isDone());
  await shot("reset");
};
