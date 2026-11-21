// Fibonacci numbers in an equilateral triangle: change N, step with the keys, Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equilateral-fibonacci
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const items = () => page.locator("#list li").count();
  log("initial:", await items(), "shapes");
  await shot("initial");
  await page.fill("#nIn", "145"); await page.press("#nIn", "Tab");
  log("N = 145:", await items(), "shapes |", await text("#status"));
  await shot("max-options");
  await page.fill("#nIn", "55"); await page.press("#nIn", "Tab");
  log("N = 55:", await items(), "shapes | done =", await isDone());
  await shot("explored");
  if (!first) return;
  await page.focus("#nIn"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
  log("two arrow ups:", await page.inputValue("#nIn"), "| focus =", await page.evaluate(() => document.activeElement.id));
  await page.fill("#nIn", "3"); await page.press("#nIn", "Tab");
  log("N typed 3:", await page.inputValue("#nIn"), "|", await text("#status"));
  await page.fill("#nIn", "147"); await page.press("#nIn", "Tab");
  log("N typed 147:", await page.inputValue("#nIn"));
  await page.click("#resetBtn");
  log("after Reset:", await page.inputValue("#nIn"), "| done =", await isDone());
  await shot("reset");
};
